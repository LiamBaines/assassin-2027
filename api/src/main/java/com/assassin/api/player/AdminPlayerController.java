package com.assassin.api.player;

import com.assassin.api.common.ApiException;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import jakarta.validation.constraints.Size;
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
    public List<AdminPlayerService.AdminPlayer> list(@PathVariable String gameId) {
        return adminPlayerService.list(gameId);
    }

    @PatchMapping("/{playerId}")
    public PlayerSummary update(@PathVariable String gameId, @PathVariable UUID playerId,
            @Valid @RequestBody UpdatePlayerRequest request) {
        if (request.status() == null && request.displayName() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Send a status or a displayName.");
        }
        Player player = null;
        if (request.displayName() != null) {
            player = adminPlayerService.rename(gameId, playerId, request.displayName());
        }
        if (request.status() != null) {
            player = adminPlayerService.updateStatus(gameId, playerId, request.status());
        }
        return PlayerSummary.from(player);
    }

    public record UpdatePlayerRequest(PlayerStatus status, @Size(max = 64) String displayName) {

        public UpdatePlayerRequest {
            displayName = displayName == null ? null : displayName.strip();
        }
    }
}
