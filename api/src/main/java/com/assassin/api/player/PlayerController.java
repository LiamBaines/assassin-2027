package com.assassin.api.player;

import com.assassin.api.common.CurrentUser;
import com.assassin.api.game.Game;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PlayerController {

    private final PlayerService playerService;

    public PlayerController(PlayerService playerService) {
        this.playerService = playerService;
    }

    @PostMapping("/api/players")
    @ResponseStatus(HttpStatus.CREATED)
    public PlayerSummary signup(CurrentUser user, @Valid @RequestBody SignupRequest request) {
        return PlayerSummary.from(playerService.signup(user, request.displayName(), request.joinCode()));
    }

    public record SignupRequest(
            @NotBlank @Size(min = 2, max = 32) String displayName,
            @NotBlank @Size(max = 64) String joinCode) {

        public SignupRequest {
            displayName = displayName == null ? null : displayName.strip();
            joinCode = Game.normalizeJoinCode(joinCode);
        }
    }
}
