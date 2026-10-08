package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/rings")
public class AdminRingController {

    private final RingService ringService;

    public AdminRingController(RingService ringService) {
        this.ringService = ringService;
    }

    /** Generates the initial ring, or shakes up the current one. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoundResponse shuffle(CurrentUser admin, @RequestBody ShuffleRequest request) {
        return RoundResponse.from(ringService.shuffle(request.expectedCurrentRoundNo(), admin.email()));
    }

    @GetMapping("/current")
    public RingService.CurrentRing current() {
        return ringService.currentRing();
    }

    @GetMapping
    public List<RoundResponse> history() {
        return ringService.history().stream().map(RoundResponse::from).toList();
    }

    /** @param expectedCurrentRoundNo the current round number the admin saw, or null if there were no rounds */
    public record ShuffleRequest(Integer expectedCurrentRoundNo) {
    }

    public record RoundResponse(int roundNo, RoundReason reason, int playerCount, String createdBy,
            Instant createdAt) {

        static RoundResponse from(AssignmentRound r) {
            return new RoundResponse(r.getRoundNo(), r.getReason(), r.getPlayerCount(), r.getCreatedBy(),
                    r.getCreatedAt());
        }
    }
}
