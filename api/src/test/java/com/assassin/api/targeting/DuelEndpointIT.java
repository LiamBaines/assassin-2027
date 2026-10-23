package com.assassin.api.targeting;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class DuelEndpointIT extends IntegrationTest {

    private String gameId;
    private String base;
    private String challenger;
    private String challenged;
    private String bystander;

    @BeforeEach
    void seed() throws Exception {
        gameId = insertGame("ABC123", "SETUP", true);
        base = "/api/me/games/" + gameId + "/duels";
        for (String n : List.of("Alice", "Bob", "Carol", "Dave")) {
            insertPlayer(gameId, n.toLowerCase() + "@example.com", n, "ALIVE");
        }
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
        challenger = "alice@example.com";
        challenged = emailOf("target_id", challenger);
        bystander = jdbc.queryForObject("""
                select email from game.player where email not in (?, ?)
                   and id <> (select assassin_id from game.assignment where target_id = (
                       select id from game.player where email = ?) and status = 'ACTIVE')
                 limit 1
                """, String.class, challenger, challenged, challenger);
    }

    private String emailOf(String column, String assassinEmail) {
        return jdbc.queryForObject("""
                select p.email from game.assignment a
                  join game.player me on me.id = a.assassin_id
                  join game.player p on p.id = a.%s
                 where a.status = 'ACTIVE' and me.email = ?
                """.formatted(column), String.class, assassinEmail);
    }

    private long challenge(String activity) throws Exception {
        String body = mvc.perform(as(challenger, post(base).contentType(MediaType.APPLICATION_JSON)
                .content("{\"activity\": \"" + activity + "\"}"))).andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING")).andReturn().getResponse().getContentAsString();
        return Long.parseLong(body.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    private org.springframework.test.web.servlet.ResultActions act(String email, long id, String action, String json)
            throws Exception {
        return mvc.perform(as(email, post(base + "/" + id + "/" + action).contentType(MediaType.APPLICATION_JSON)
                .content(json)));
    }

    @Test
    void requiresAuth() throws Exception {
        mvc.perform(post(base).contentType(MediaType.APPLICATION_JSON).content("{\"activity\":\"Chess\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(base + "/1/accept")).andExpect(status().isUnauthorized());
    }

    @Test
    void nonPlayerGetsNotInGame() throws Exception {
        mvc.perform(as("stranger@example.com", post(base).contentType(MediaType.APPLICATION_JSON)
                .content("{\"activity\":\"Chess\"}"))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
        mvc.perform(as("stranger@example.com", post(base + "/1/accept"))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void onlyTheRightParticipantMayAct() throws Exception {
        long id = challenge("Chess");
        act(challenger, id, "accept", "").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_DUEL_PARTICIPANT"));
        act(challenger, id, "decline", "").andExpect(status().isForbidden());
        act(bystander, id, "accept", "").andExpect(status().isForbidden());
        act(bystander, id, "revoke", "").andExpect(status().isForbidden());
        act(challenged, id, "revoke", "").andExpect(status().isForbidden());
        act(challenged, id + 1000, "accept", "").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("DUEL_NOT_FOUND"));

        act(challenged, id, "accept", "").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACCEPTED"));
        act(challenged, id, "accept", "").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUEL_NOT_OPEN"));
        act(bystander, id, "report", "{\"winner\":\"ME\"}").andExpect(status().isForbidden());
        act(challenged, id, "report", "{}").andExpect(status().isBadRequest());
        act(challenged, id, "report", "{\"winner\":\"ME\"}").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REPORTED"));
        act(challenged, id, "confirm", "").andExpect(status().isForbidden());
        act(bystander, id, "contest", "").andExpect(status().isForbidden());
        act(challenger, id, "contest", "").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONTESTED"));
    }

    @Test
    void confirmedReportCompletesTheDuel() throws Exception {
        long id = challenge("Chess");
        act(challenged, id, "accept", "").andExpect(status().isOk());
        act(challenger, id, "report", "{\"winner\":\"ME\"}").andExpect(status().isOk());
        act(challenged, id, "confirm", "").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"));
    }

    @Test
    void challengeValidatesAndMapsErrors() throws Exception {
        mvc.perform(as(challenger, post(base).contentType(MediaType.APPLICATION_JSON).content("{\"activity\":\" \"}")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_ACTIVITY"));
        challenge("Chess");
        mvc.perform(as(challenger, post(base).contentType(MediaType.APPLICATION_JSON)
                .content("{\"activity\":\"Darts\"}"))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUEL_ALREADY_OPEN"));
    }

    @Test
    void threadsShowTheDuelAndRevealTheAssassinOnlyAfterAccept() throws Exception {
        long id = challenge("Chess");
        String messages = "/api/me/games/" + gameId + "/messages";

        mvc.perform(as(challenger, get(messages))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].with").value("TARGET"))
                .andExpect(jsonPath("$[0].messages[0].kind").value("DUEL"))
                .andExpect(jsonPath("$[0].messages[0].mine").value(true))
                .andExpect(jsonPath("$[0].messages[0].duel.id").value(id))
                .andExpect(jsonPath("$[0].messages[0].duel.status").value("PENDING"))
                .andExpect(jsonPath("$[0].messages[0].duel.activity").value("Chess"))
                .andExpect(jsonPath("$[0].messages[0].duel.challengerIsMe").value(true));
        mvc.perform(as(challenged, get(messages))).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.with=='ASSASSIN')].messages[0].duel.challengerIsMe").value(false))
                .andExpect(jsonPath("$[?(@.with=='ASSASSIN')].messages[0].duel.assassinName").value(
                        org.hamcrest.Matchers.contains((Object) null)));

        act(challenged, id, "accept", "").andExpect(status().isOk());
        mvc.perform(as(challenged, get(messages))).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.with=='ASSASSIN')].messages[0].duel.assassinName").value("Alice"));
        mvc.perform(as(challenger, get(messages))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].messages[0].duel.assassinName").doesNotExist());

        act(challenged, id, "report", "{\"winner\":\"OTHER\"}").andExpect(status().isOk());
        mvc.perform(as(challenger, get(messages))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].messages[0].duel.reportedWinner").value("ME"))
                .andExpect(jsonPath("$[0].messages[0].duel.reportedByMe").value(false));
    }
}
