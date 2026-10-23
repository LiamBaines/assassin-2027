package com.assassin.api.targeting;

import com.assassin.api.common.ApiException;
import com.assassin.api.common.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/games/{gameId}/duels")
public class DuelController {

    private final DuelService service;

    public DuelController(DuelService service) {
        this.service = service;
    }

    public record ChallengeRequest(String activity) {
    }

    public record ReportRequest(DuelService.Winner winner) {
    }

    /** 400 INVALID_ACTIVITY, 409 DUEL_NOT_AVAILABLE, NO_TARGET, DUEL_ALREADY_OPEN, GAME_NOT_STARTED. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DuelService.DuelStatusView challenge(CurrentUser user, @PathVariable String gameId,
            @RequestBody ChallengeRequest request) {
        return service.challenge(gameId, user.authUserId(), request.activity());
    }

    @PostMapping("/{id}/accept")
    public DuelService.DuelStatusView accept(CurrentUser user, @PathVariable String gameId, @PathVariable long id) {
        return service.accept(gameId, id, user.authUserId());
    }

    @PostMapping("/{id}/decline")
    public DuelService.DuelStatusView decline(CurrentUser user, @PathVariable String gameId, @PathVariable long id) {
        return service.decline(gameId, id, user.authUserId());
    }

    @PostMapping("/{id}/revoke")
    public DuelService.DuelStatusView revoke(CurrentUser user, @PathVariable String gameId, @PathVariable long id) {
        return service.revoke(gameId, id, user.authUserId());
    }

    /** 400 INVALID_WINNER when {@code winner} is missing. */
    @PostMapping("/{id}/report")
    public DuelService.DuelStatusView report(CurrentUser user, @PathVariable String gameId, @PathVariable long id,
            @RequestBody ReportRequest request) {
        if (request.winner() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_WINNER", "Choose ME or OTHER.");
        }
        return service.report(gameId, id, user.authUserId(), request.winner());
    }

    @PostMapping("/{id}/confirm")
    public DuelService.DuelResult confirm(CurrentUser user, @PathVariable String gameId, @PathVariable long id) {
        return service.confirm(gameId, id, user.authUserId());
    }

    @PostMapping("/{id}/contest")
    public DuelService.DuelStatusView contest(CurrentUser user, @PathVariable String gameId, @PathVariable long id) {
        return service.contest(gameId, id, user.authUserId());
    }
}
