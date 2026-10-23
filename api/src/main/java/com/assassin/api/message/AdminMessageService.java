package com.assassin.api.message;

import com.assassin.api.common.ApiException;
import com.assassin.api.game.GameService;
import com.assassin.api.player.Player;
import com.assassin.api.player.PlayerRepository;
import com.assassin.api.targeting.Assignment;
import com.assassin.api.targeting.AssignmentRepository;
import com.assassin.api.targeting.AssignmentStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Admin view of a game's messages, with real names. Ended threads are included. */
@Service
public class AdminMessageService {

    public record AdminMessageView(long id, long assignmentId, AssignmentStatus assignmentStatus, UUID senderId,
                                   String senderName, UUID recipientId, String recipientName, String body,
                                   Instant createdAt, Instant readAt) {
    }

    private final MessageRepository messages;
    private final AssignmentRepository assignments;
    private final PlayerRepository players;
    private final GameService games;

    public AdminMessageService(MessageRepository messages, AssignmentRepository assignments,
                               PlayerRepository players, GameService games) {
        this.messages = messages;
        this.assignments = assignments;
        this.players = players;
        this.games = games;
    }

    /** Undeleted messages, oldest first. */
    @Transactional(readOnly = true)
    public List<AdminMessageView> list(String gameId) {
        games.find(gameId);
        List<Message> all = messages.findByGameIdAndKindAndDeletedAtIsNullOrderById(gameId, MessageKind.PLAYER);
        Map<Long, Assignment> byAssignment = assignments.findAllById(
                all.stream().map(Message::getAssignmentId).distinct().toList()).stream()
                .collect(Collectors.toMap(Assignment::getId, Function.identity()));
        Map<UUID, String> names = players.findByGameIdOrderByJoinedAtAsc(gameId).stream()
                .collect(Collectors.toMap(Player::getId, Player::getDisplayName));
        return all.stream().map(m -> {
            Assignment a = byAssignment.get(m.getAssignmentId());
            boolean fromAssassin = m.getSenderId().equals(a.getAssassinId());
            UUID recipient = fromAssassin ? a.getTargetId() : a.getAssassinId();
            return new AdminMessageView(m.getId(), a.getId(), a.getStatus(), m.getSenderId(),
                    names.get(m.getSenderId()), recipient, names.get(recipient), m.getBody(), m.getCreatedAt(),
                    m.getReadAt());
        }).toList();
    }

    @Transactional
    public void delete(String gameId, long messageId) {
        games.find(gameId);
        Message m = messages.findById(messageId)
                .filter(x -> x.getGameId().equals(gameId) && x.getDeletedAt() == null)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MESSAGE_NOT_FOUND",
                        "That message doesn't exist or was already deleted."));
        m.markDeleted(Instant.now());
    }
}
