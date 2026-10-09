package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/games/{gameId}/kill-claims")
public class AdminKillClaimController {

    private final KillClaimService service;

    public AdminKillClaimController(KillClaimService service) {
        this.service = service;
    }

    @GetMapping
    public List<KillClaimService.AdminClaim> list(@PathVariable UUID gameId,
            @RequestParam(defaultValue = "open") String status) {
        return service.listOpen(gameId);
    }

    @PostMapping("/{id}/confirm")
    public KillService.KillResult confirm(@PathVariable UUID gameId, @PathVariable long id, CurrentUser admin) {
        return service.adminConfirm(gameId, id, admin.email());
    }

    @PostMapping("/{id}/dismiss")
    public KillClaimService.ClaimStatus dismiss(@PathVariable UUID gameId, @PathVariable long id,
            CurrentUser admin) {
        return service.adminDismiss(gameId, id, admin.email());
    }
}
