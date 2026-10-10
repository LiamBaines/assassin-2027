package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/games/{gameId}/rounds")
public class AdminRoundController {

    private final RingService ringService;
    private final RoundHistoryService history;

    public AdminRoundController(RingService ringService, RoundHistoryService history) {
        this.ringService = ringService;
        this.history = history;
    }

    /** Every round of the game, newest first. */
    @GetMapping
    public List<RoundHistoryService.AdminRound> list(@PathVariable UUID gameId) {
        return history.adminRounds(gameId);
    }

    /** Closes the current round and starts the next one with the given players. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RingService.RingView start(@PathVariable UUID gameId, CurrentUser admin,
            @RequestBody StartRoundRequest request) {
        return ringService.startRound(gameId, request.expectedRoundNo(), request.playerIds(), admin.email());
    }

    public record StartRoundRequest(Integer expectedRoundNo, List<UUID> playerIds) {

        public StartRoundRequest {
            playerIds = playerIds == null ? List.of() : playerIds;
        }
    }
}
