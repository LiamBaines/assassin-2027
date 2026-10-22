package com.assassin.api.message;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AdminMessageEndpointIT extends IntegrationTest {

    private String gameId;
    private String base;
    private String adminBase;
    private String assassin;

    @BeforeEach
    void seed() throws Exception {
        gameId = insertGame("ABC123", "SETUP", true);
        base = "/api/me/games/" + gameId + "/messages";
        adminBase = "/api/admin/games/" + gameId + "/messages";
        for (String n : List.of("Alice", "Bob", "Carol", "Dave")) {
            insertPlayer(gameId, n.toLowerCase() + "@example.com", n, "ALIVE");
        }
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
        assassin = "alice@example.com";
        mvc.perform(as(assassin, post(base).contentType(MediaType.APPLICATION_JSON)
                .content("{\"with\": \"TARGET\", \"body\": \"hello\"}"))).andExpect(status().isCreated());
    }

    @Test
    void requiresAdmin() throws Exception {
        mvc.perform(get(adminBase)).andExpect(status().isUnauthorized());
        mvc.perform(as(assassin, get(adminBase))).andExpect(status().isForbidden());
        mvc.perform(as(assassin, delete(adminBase + "/1"))).andExpect(status().isForbidden());
    }

    @Test
    void listsWithNamesAndAssignmentStatus() throws Exception {
        mvc.perform(asAdmin(get(adminBase))).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].body").value("hello"))
                .andExpect(jsonPath("$[0].senderName").value("Alice"))
                .andExpect(jsonPath("$[0].recipientName").isNotEmpty())
                .andExpect(jsonPath("$[0].assignmentStatus").value("ACTIVE"));
    }

    @Test
    void unknownGameIs404() throws Exception {
        mvc.perform(asAdmin(get("/api/admin/games/nope/messages"))).andExpect(status().isNotFound());
    }

    @Test
    void deleteHidesMessageFromAdminAndPlayers() throws Exception {
        long id = jdbc.queryForObject("select id from game.message", Long.class);
        mvc.perform(asAdmin(delete(adminBase + "/" + id))).andExpect(status().isNoContent());
        mvc.perform(asAdmin(get(adminBase))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(as(assassin, get(base))).andExpect(jsonPath("$[0].messages.length()").value(0));
        mvc.perform(asAdmin(delete(adminBase + "/" + id))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("MESSAGE_NOT_FOUND"));
    }

    @Test
    void deleteIsScopedToTheGame() throws Exception {
        long id = jdbc.queryForObject("select id from game.message", Long.class);
        String other = insertGame("Other game", "OTH001", "SETUP", true);
        mvc.perform(asAdmin(delete("/api/admin/games/" + other + "/messages/" + id)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("MESSAGE_NOT_FOUND"));
    }
}
