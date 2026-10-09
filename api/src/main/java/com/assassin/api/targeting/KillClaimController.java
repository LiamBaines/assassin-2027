package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/games/{gameId}/kill-claims")
public class KillClaimController {

    private final KillClaimService service;

    public KillClaimController(KillClaimService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public KillClaimService.ClaimStatus file(CurrentUser user, @PathVariable UUID gameId) {
        return service.file(gameId, user.authUserId());
    }

    @PostMapping("/{id}/withdraw")
    public KillClaimService.ClaimStatus withdraw(CurrentUser user, @PathVariable UUID gameId, @PathVariable long id) {
        return service.withdraw(gameId, id, user.authUserId());
    }

    @PostMapping("/{id}/accept")
    public KillClaimService.AcceptResult accept(CurrentUser user, @PathVariable UUID gameId, @PathVariable long id) {
        return service.accept(gameId, id, user.authUserId());
    }

    @PostMapping("/{id}/contest")
    public KillClaimService.ClaimStatus contest(CurrentUser user, @PathVariable UUID gameId, @PathVariable long id) {
        return service.contest(gameId, id, user.authUserId());
    }

    @GetMapping("/mine")
    public KillClaimService.MyClaims mine(CurrentUser user, @PathVariable UUID gameId) {
        return service.mine(gameId, user.authUserId());
    }
}
