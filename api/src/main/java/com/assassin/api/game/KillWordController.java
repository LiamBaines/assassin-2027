package com.assassin.api.game;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class KillWordController {

    private final KillWordService service;

    public KillWordController(KillWordService service) {
        this.service = service;
    }

    public record AddWordsRequest(List<String> words) {
    }

    /** The game's word list: unused, allocated and used words. */
    @GetMapping("/api/admin/games/{gameId}/kill-words")
    public List<KillWordService.KillWordView> list(@PathVariable String gameId) {
        return service.list(gameId);
    }

    /** Adds one or several words, all or nothing. */
    @PostMapping("/api/admin/games/{gameId}/kill-words")
    @ResponseStatus(HttpStatus.CREATED)
    public List<KillWordService.KillWordView> add(@PathVariable String gameId, @RequestBody AddWordsRequest request) {
        return service.add(gameId, request.words());
    }

    /** Deletes an unallocated word. */
    @DeleteMapping("/api/admin/games/{gameId}/kill-words/{wordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String gameId, @PathVariable long wordId) {
        service.delete(gameId, wordId);
    }
}
