package com.assassin.api.game;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/game")
public class AdminGameController {

    static final String JOIN_CODE_PATTERN = "^[A-Z0-9]{6,16}$";
    static final String JOIN_CODE_MESSAGE = "must be 6-16 letters or digits";

    private final GameService gameService;

    public AdminGameController(GameService gameService) {
        this.gameService = gameService;
    }

    @GetMapping
    public GameResponse get() {
        return GameResponse.from(gameService.getLive());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GameResponse create(@Valid @RequestBody CreateGameRequest request) {
        return GameResponse.from(gameService.create(request.name(), request.joinCode()));
    }

    @PatchMapping
    public GameResponse update(@Valid @RequestBody UpdateGameRequest request) {
        return GameResponse.from(gameService.update(
                request.name(), request.joinCode(), request.signupsOpen(), request.status()));
    }

    public record CreateGameRequest(
            @NotBlank @Size(max = 100) String name,
            @NotNull @Pattern(regexp = JOIN_CODE_PATTERN, message = JOIN_CODE_MESSAGE) String joinCode) {

        public CreateGameRequest {
            name = strip(name);
            joinCode = Game.normalizeJoinCode(joinCode);
        }
    }

    public record UpdateGameRequest(
            @Size(min = 1, max = 100) String name,
            @Pattern(regexp = JOIN_CODE_PATTERN, message = JOIN_CODE_MESSAGE) String joinCode,
            Boolean signupsOpen,
            GameStatus status) {

        public UpdateGameRequest {
            name = strip(name);
            joinCode = Game.normalizeJoinCode(joinCode);
        }
    }

    public record GameResponse(UUID id, String name, String joinCode, GameStatus status, boolean signupsOpen,
            Instant createdAt, Instant startedAt, Instant finishedAt) {

        static GameResponse from(Game g) {
            return new GameResponse(g.getId(), g.getName(), g.getJoinCode(), g.getStatus(), g.isSignupsOpen(),
                    g.getCreatedAt(), g.getStartedAt(), g.getFinishedAt());
        }
    }

    private static String strip(String s) {
        return s == null ? null : s.strip();
    }
}
