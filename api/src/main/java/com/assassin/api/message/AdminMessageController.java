package com.assassin.api.message;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AdminMessageController {

    private final AdminMessageService service;

    public AdminMessageController(AdminMessageService service) {
        this.service = service;
    }

    @GetMapping("/api/admin/games/{gameId}/messages")
    public List<AdminMessageService.AdminMessageView> list(@PathVariable String gameId) {
        return service.list(gameId);
    }

    /** Soft-deletes a message; it disappears for players too. 404 MESSAGE_NOT_FOUND. */
    @DeleteMapping("/api/admin/games/{gameId}/messages/{messageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String gameId, @PathVariable long messageId) {
        service.delete(gameId, messageId);
    }
}
