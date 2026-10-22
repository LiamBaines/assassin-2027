package com.assassin.api.message;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import com.assassin.api.message.MessageService.Counterpart;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MessageController {

    private final MessageService service;

    public MessageController(MessageService service) {
        this.service = service;
    }

    /** @param with TARGET or ASSASSIN */
    public record SendRequest(Counterpart with, String body) {
    }

    public record ReadRequest(Counterpart with) {
    }

    public record UnreadCount(long unread) {
    }

    /** The caller's live threads (empty list if they have no active pairing). 404 NOT_IN_GAME. */
    @GetMapping("/api/me/games/{gameId}/messages")
    public List<MessageService.ThreadView> threads(CurrentUser user, @PathVariable String gameId) {
        return service.threads(gameId, user.authUserId());
    }

    /** 400 INVALID_MESSAGE, 409 NO_ACTIVE_PAIRING, 429 RATE_LIMITED. */
    @PostMapping("/api/me/games/{gameId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageService.MessageView send(CurrentUser user, @PathVariable String gameId,
                                           @RequestBody SendRequest request) {
        return service.send(gameId, user.authUserId(), required(request.with()), request.body());
    }

    /** Marks the other side's messages in one thread as read. */
    @PostMapping("/api/me/games/{gameId}/messages/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(CurrentUser user, @PathVariable String gameId, @RequestBody ReadRequest request) {
        service.markRead(gameId, user.authUserId(), required(request.with()));
    }

    @GetMapping("/api/me/games/{gameId}/messages/unread-count")
    public UnreadCount unreadCount(CurrentUser user, @PathVariable String gameId) {
        return new UnreadCount(service.unreadCount(gameId, user.authUserId()));
    }

    private static Counterpart required(Counterpart with) {
        if (with == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_MESSAGE", "Choose TARGET or ASSASSIN.");
        }
        return with;
    }
}
