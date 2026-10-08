package com.assassin.api.game;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
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
@RequestMapping("/api/admin/games")
public class AdminGameController {

    static final String JOIN_CODE_PATTERN = "^[A-Z0-9]{6,16}$";
    static final String JOIN_CODE_MESSAGE = "must be 6-16 letters or digits";

    private final GameService gameService;

    public AdminGameController(GameService gameService) {
        this.gameService = gameService;
    }

    /** Every game, including FINISHED ones, newest first. */
    @GetMapping
    public List<GameResponse> list() {
        return gameService.list().stream().map(GameResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GameResponse create(@Valid @RequestBody CreateGameRequest request) {
        return GameResponse.from(gameService.create(request.name(), request.joinCode()));
    }

    @GetMapping("/{gameId}")
    public GameResponse get(@PathVariable UUID gameId) {
        return GameResponse.from(gameService.get(gameId));
    }

    @PatchMapping("/{gameId}")
    public GameResponse update(@PathVariable UUID gameId, @Valid @RequestBody UpdateGameRequest request) {
        return GameResponse.from(gameService.update(
                gameId, request.name(), request.joinCode(), request.signupsOpen(), request.status()));
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
            Instant createdAt, Instant startedAt, Instant finishedAt, long playerCount) {

        static GameResponse from(GameService.GameWithCount gc) {
            Game g = gc.game();
            return new GameResponse(g.getId(), g.getName(), g.getJoinCode(), g.getStatus(), g.isSignupsOpen(),
                    g.getCreatedAt(), g.getStartedAt(), g.getFinishedAt(), gc.playerCount());
        }
    }

    private static String strip(String s) {
        return s == null ? null : s.strip();
    }
}
