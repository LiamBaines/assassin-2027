package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AdminDuelEndpointIT extends IntegrationTest {

    private String gameId;
    private String admin;
    private String challenger;
    private String challenged;

    @BeforeEach
    void seed() throws Exception {
        gameId = insertGame("ABC123", "SETUP", true);
        admin = "/api/admin/games/" + gameId + "/duels";
        for (String n : List.of("Alice", "Bob", "Carol", "Dave")) {
            insertPlayer(gameId, n.toLowerCase() + "@example.com", n, "ALIVE");
        }
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
        challenger = "alice@example.com";
        challenged = jdbc.queryForObject("""
                select p.email from game.assignment a
                  join game.player me on me.id = a.assassin_id
                  join game.player p on p.id = a.target_id
                 where a.status = 'ACTIVE' and me.email = ?
                """, String.class, challenger);
    }

    private long challenge() throws Exception {
        String body = mvc.perform(as(challenger, post("/api/me/games/" + gameId + "/duels")
                .contentType(MediaType.APPLICATION_JSON).content("{\"activity\":\"Chess\"}")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    private UUID playerId(String email) {
        return jdbc.queryForObject("select id from game.player where email = ?", UUID.class, email);
    }

    @Test
    void requiresAdmin() throws Exception {
        mvc.perform(get(admin)).andExpect(status().isUnauthorized());
        mvc.perform(as(challenger, get(admin))).andExpect(status().isForbidden());
        mvc.perform(as(challenger, post(admin + "/1/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{}"))).andExpect(status().isForbidden());
    }

    @Test
    void listsOpenDuelsOnly() throws Exception {
        mvc.perform(asAdmin(get(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        long id = challenge();
        mvc.perform(asAdmin(get(admin))).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(id))
                .andExpect(jsonPath("$[0].status").value("PENDING"))
                .andExpect(jsonPath("$[0].activity").value("Chess"))
                .andExpect(jsonPath("$[0].challenger.displayName").value("Alice"));
        mvc.perform(as(challenger, post("/api/me/games/" + gameId + "/duels/" + id + "/revoke")))
                .andExpect(status().isOk());
        mvc.perform(asAdmin(get(admin))).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void unknownGameIs404() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/nope/duels"))).andExpect(status().isNotFound());
    }

    @Test
    void resolveValidatesAndLogsAnEvent() throws Exception {
        long id = challenge();
        mvc.perform(asAdmin(post(admin + "/" + id + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{}"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_WINNER"));
        mvc.perform(asAdmin(post(admin + "/" + (id + 1000) + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"winnerId\":\"" + playerId(challenger) + "\"}"))).andExpect(status().isNotFound());
        mvc.perform(asAdmin(post(admin + "/" + id + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"winnerId\":\"" + playerId(challenger) + "\"}"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
        assertThat(jdbc.queryForObject("select count(*) from game.game_event where game_id = ? and type = 'DUEL_RESOLVED'",
                Integer.class, gameId)).isEqualTo(1);
        mvc.perform(asAdmin(post(admin + "/" + id + "/resolve").contentType(MediaType.APPLICATION_JSON)
                .content("{\"winnerId\":\"" + playerId(challenger) + "\"}"))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUEL_NOT_OPEN"));
    }
}
