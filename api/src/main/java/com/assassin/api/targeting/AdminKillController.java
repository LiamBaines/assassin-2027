package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/games/{gameId}/kills")
public class AdminKillController {

    private final KillService killService;

    public AdminKillController(KillService killService) {
        this.killService = killService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public KillService.KillResult register(@PathVariable UUID gameId, CurrentUser admin,
            @Valid @RequestBody RegisterKillRequest request) {
        return killService.register(gameId, request.victimId(), request.killMethodId(), admin.email());
    }

    @GetMapping
    public List<KillService.KillView> list(@PathVariable UUID gameId) {
        return killService.list(gameId);
    }

    @PatchMapping("/{killId}")
    public KillService.KillMethodChange changeMethod(@PathVariable UUID gameId, @PathVariable long killId,
            CurrentUser admin, @Valid @RequestBody ChangeMethodRequest request) {
        return killService.changeMethod(gameId, killId, request.killMethodId(), admin.email());
    }

    public record ChangeMethodRequest(Long killMethodId) {
    }

    public record RegisterKillRequest(@NotNull UUID victimId, Long killMethodId) {
    }
}
