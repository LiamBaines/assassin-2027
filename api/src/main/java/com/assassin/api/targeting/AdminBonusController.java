package com.assassin.api.targeting;

import com.assassin.api.common.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
@RequestMapping("/api/admin/games/{gameId}/bonuses")
public class AdminBonusController {

    private final BonusService service;

    public AdminBonusController(BonusService service) {
        this.service = service;
    }

    /** 400 INVALID_BONUS_POINTS, REASON_REQUIRED, KILL_PLAYER_MISMATCH; 404 PLAYER_NOT_FOUND, KILL_NOT_FOUND. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BonusService.BonusView award(@PathVariable String gameId, CurrentUser admin,
            @Valid @RequestBody AwardBonusRequest request) {
        return service.award(gameId, request.playerId(), request.points(), request.reason(), request.killId(),
                admin.email());
    }

    @GetMapping
    public List<BonusService.BonusView> list(@PathVariable String gameId) {
        return service.list(gameId);
    }

    public record AwardBonusRequest(@NotNull UUID playerId, @NotNull Integer points, String reason, Long killId) {
    }
}
