package com.assassin.api.message;

import com.assassin.api.common.ApiException;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.player.PlayerStatus;
import com.assassin.api.targeting.Assignment;
import com.assassin.api.targeting.AssignmentRepository;
import com.assassin.api.targeting.AssignmentStatus;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Anonymous messages along the current ring. A thread is one ACTIVE assignment; the other side is only ever "your
 * target" or "your assassin". Each player also has a read-only Admin thread, which belongs to them rather than an
 * assignment.
 */
@Service
public class MessageService {

    static final int MAX_LENGTH = 280;
    static final int RATE_LIMIT = 5;
    static final Duration RATE_WINDOW = Duration.ofMinutes(1);

    /** Who the caller is talking to. */
    public enum Counterpart { TARGET, ASSASSIN, ADMIN }

    public record MessageView(long id, boolean mine, String body, Instant createdAt, boolean read) {
    }

    public record ThreadView(Counterpart with, List<MessageView> messages, int unread) {
    }

    private final MessageRepository messages;
    private final AssignmentRepository assignments;
    private final PlayerRepository players;

    public MessageService(MessageRepository messages, AssignmentRepository assignments, PlayerRepository players) {
        this.messages = messages;
        this.assignments = assignments;
        this.players = players;
    }

    /** The caller's live threads: one per current assignment they are part of. Empty if they have none. */
    @Transactional(readOnly = true)
    public List<ThreadView> threads(String gameId, UUID authUserId) {
        Player me = player(gameId, authUserId);
        List<ThreadView> result = new ArrayList<>();
        for (Counterpart with : Counterpart.values()) {
            if (with == Counterpart.ADMIN) {
                adminThread(me).ifPresent(result::add);
            } else {
                activeAssignment(me, with).ifPresent(a -> result.add(thread(with, a, me)));
            }
        }
        return result;
    }

    @Transactional
    public MessageView send(String gameId, UUID authUserId, Counterpart with, String rawBody) {
        if (with == Counterpart.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "THREAD_READ_ONLY", "You can't reply to the admin.");
        }
        String body = rawBody == null ? "" : rawBody.trim();
        if (body.isEmpty() || body.length() > MAX_LENGTH) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE",
                    "Messages must be 1 to " + MAX_LENGTH + " characters.");
        }
        Player me = player(gameId, authUserId);
        Assignment a = activeAssignment(me, with).orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                "NO_ACTIVE_PAIRING", "You have no " + (with == Counterpart.TARGET ? "target" : "assassin")
                        + " to message right now."));
        Instant now = Instant.now();
        if (messages.countByAssignmentIdAndSenderIdAndCreatedAtAfter(a.getId(), me.getId(), now.minus(RATE_WINDOW))
                >= RATE_LIMIT) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                    "You're sending too fast. Wait a minute and try again.");
        }
        Message saved = messages.save(new Message(gameId, a.getId(), me.getId(), body, now));
        return view(saved, me.getId());
    }

    /** Marks everything the other side sent in the thread as read. A no-op when there is no live thread. */
    @Transactional
    public void markRead(String gameId, UUID authUserId, Counterpart with) {
        Player me = player(gameId, authUserId);
        if (with == Counterpart.ADMIN) {
            messages.markAdminRead(me.getId(), Instant.now());
            return;
        }
        activeAssignment(me, with).ifPresent(a -> messages.markRead(a.getId(), me.getId(), Instant.now()));
    }

    /** Unread messages across the caller's live threads. 0 for someone with no ring position. */
    @Transactional(readOnly = true)
    public long unreadCount(String gameId, UUID authUserId) {
        Player me = player(gameId, authUserId);
        List<Long> ids = new ArrayList<>();
        for (Counterpart with : List.of(Counterpart.TARGET, Counterpart.ASSASSIN)) {
            activeAssignment(me, with).ifPresent(a -> ids.add(a.getId()));
        }
        long fromAdmin = messages.countAdminUnread(me.getId());
        return fromAdmin + (ids.isEmpty() ? 0 : messages.countUnread(ids, me.getId()));
    }

    private ThreadView thread(Counterpart with, Assignment a, Player me) {
        List<MessageView> views = messages.findByAssignmentIdAndDeletedAtIsNullOrderById(a.getId()).stream()
                .map(m -> view(m, me.getId())).toList();
        int unread = (int) views.stream().filter(v -> !v.mine() && !v.read()).count();
        return new ThreadView(with, views, unread);
    }

    /** The Admin thread, present once the player has received at least one admin message. */
    private Optional<ThreadView> adminThread(Player me) {
        List<MessageView> views = messages.findByRecipientIdAndKindAndDeletedAtIsNullOrderById(me.getId(),
                MessageKind.ADMIN).stream().map(m -> view(m, me.getId())).toList();
        if (views.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new ThreadView(Counterpart.ADMIN, views, (int) views.stream().filter(v -> !v.read()).count()));
    }

    private static MessageView view(Message m, UUID viewerId) {
        return new MessageView(m.getId(), viewerId.equals(m.getSenderId()), m.getBody(), m.getCreatedAt(),
                m.getReadAt() != null);
    }

    private Player player(String gameId, UUID authUserId) {
        return players.findByGameIdAndAuthUserId(gameId, authUserId).orElseThrow(
                () -> new ApiException(HttpStatus.NOT_FOUND, "NOT_IN_GAME", "You are not in this game."));
    }

    /** The ACTIVE assignment linking the caller to {@code with}, if both ends are still ALIVE. */
    private Optional<Assignment> activeAssignment(Player me, Counterpart with) {
        if (me.getStatus() != PlayerStatus.ALIVE) {
            return Optional.empty();
        }
        Optional<Assignment> found = with == Counterpart.TARGET
                ? assignments.findByAssassinIdAndStatus(me.getId(), AssignmentStatus.ACTIVE)
                : assignments.findByTargetIdAndStatus(me.getId(), AssignmentStatus.ACTIVE);
        return found.filter(a -> {
            UUID otherId = with == Counterpart.TARGET ? a.getTargetId() : a.getAssassinId();
            return players.findById(otherId).map(p -> p.getStatus() == PlayerStatus.ALIVE).orElse(false);
        });
    }
}
