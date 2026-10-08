package com.assassin.api.player;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/games/{gameId}/players")
public class AdminPlayerController {

    private final AdminPlayerService adminPlayerService;

    public AdminPlayerController(AdminPlayerService adminPlayerService) {
        this.adminPlayerService = adminPlayerService;
    }

    @GetMapping
    public List<AdminPlayerService.AdminPlayer> list(@PathVariable UUID gameId) {
        return adminPlayerService.list(gameId);
    }

    @PatchMapping("/{playerId}")
    public PlayerSummary update(@PathVariable UUID gameId, @PathVariable UUID playerId,
            @Valid @RequestBody UpdatePlayerRequest request) {
        return PlayerSummary.from(adminPlayerService.updateStatus(gameId, playerId, request.status()));
    }

    public record UpdatePlayerRequest(@NotNull PlayerStatus status) {
    }
}
