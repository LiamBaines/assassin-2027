package com.assassin.api.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Append-only per-game event log, most recent first. */
@Service
public class GameEventService {

    static final int DEFAULT_LIMIT = 30;
    static final int MAX_LIMIT = 100;

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public GameEventService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** Appends an event; must run inside the transaction of the action it describes. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String gameId, String type, Object payload) {
        try {
            jdbc.update("insert into game.game_event (game_id, type, payload) values (?, ?, cast(? as jsonb))",
                    gameId, type, json.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Unserialisable event payload for " + type, e);
        }
    }

    /** One page of events with id below {@code beforeId} (null for the newest); limit defaults to 30, max 100. */
    @Transactional(readOnly = true)
    public EventPage list(String gameId, Long beforeId, Integer limit) {
        int size = limit == null ? DEFAULT_LIMIT : Math.max(1, Math.min(limit, MAX_LIMIT));
        List<Event> rows = new ArrayList<>(jdbc.query("""
                select id, type, created_at, payload from game.game_event
                 where game_id = ? and (?::bigint is null or id < ?)
                 order by id desc limit ?
                """, (rs, i) -> new Event(rs.getLong("id"), rs.getString("type"),
                rs.getObject("created_at", OffsetDateTime.class), parse(rs.getString("payload"))),
                gameId, beforeId, beforeId, size + 1));
        Long next = null;
        if (rows.size() > size) {
            rows.remove(size);
            next = rows.get(size - 1).id();
        }
        return new EventPage(rows, next);
    }

    private JsonNode parse(String payload) {
        try {
            return json.readTree(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Corrupt event payload", e);
        }
    }

    public record Event(long id, String type, OffsetDateTime createdAt, JsonNode data) {
    }

    public record EventPage(List<Event> events, Long nextBefore) {
    }
}
