package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/games/{gameId}/duels")
public class AdminDuelController {

    private final DuelService service;

    public AdminDuelController(DuelService service) {
        this.service = service;
    }

    public record ResolveRequest(UUID winnerId) {
    }

    /** Open duels, oldest first. */
    @GetMapping
    public List<DuelService.AdminDuel> list(@PathVariable String gameId) {
        return service.listOpen(gameId);
    }

    /** 400 INVALID_WINNER, 404 DUEL_NOT_FOUND, 409 DUEL_NOT_OPEN, DUEL_STALE. */
    @PostMapping("/{id}/resolve")
    public DuelService.DuelResult resolve(CurrentUser admin, @PathVariable String gameId, @PathVariable long id,
            @RequestBody ResolveRequest request) {
        if (request.winnerId() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WINNER", "Choose the winner.");
        }
        return service.adminResolve(gameId, id, request.winnerId(), admin.email());
    }
}
