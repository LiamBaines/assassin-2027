package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import java.time.Instant;
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
@RequestMapping("/api/admin/games/{gameId}/rings")
public class AdminRingController {

    private final RingService ringService;

    public AdminRingController(RingService ringService) {
        this.ringService = ringService;
    }

    /** Generates the initial ring, or shakes up the current one. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RingService.RingView shuffle(@PathVariable UUID gameId, CurrentUser admin,
            @RequestBody ShuffleRequest request) {
        return ringService.shuffle(gameId, request.expectedCurrentRoundNo(), admin.email());
    }

    @GetMapping("/current")
    public RingService.RingView current(@PathVariable UUID gameId) {
        return ringService.currentRing(gameId);
    }

    @GetMapping
    public List<RoundResponse> history(@PathVariable UUID gameId) {
        return ringService.history(gameId).stream().map(RoundResponse::from).toList();
    }

    /** @param expectedCurrentRoundNo the current allocation number the admin saw, or null if there were none (wire name kept until the rounds API lands) */
    public record ShuffleRequest(Integer expectedCurrentRoundNo) {
    }

    public record RoundResponse(UUID roundId, int roundNo, int gameRoundNo, AllocationReason reason, int playerCount,
            String createdBy, Instant createdAt) {

        static RoundResponse from(RingService.AllocationEntry e) {
            Allocation r = e.allocation();
            return new RoundResponse(r.getId(), r.getAllocationNo(), e.gameRoundNo(), r.getReason(), r.getPlayerCount(),
                    r.getCreatedBy(), r.getCreatedAt());
        }
    }
}
