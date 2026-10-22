package com.assassin.api.message;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class MessageEndpointIT extends IntegrationTest {

    private String gameId;
    private String base;

    @BeforeEach
    void seed() throws Exception {
        gameId = insertGame("ABC123", "SETUP", true);
        base = "/api/me/games/" + gameId + "/messages";
        for (String n : List.of("Alice", "Bob", "Carol", "Dave")) {
            insertPlayer(gameId, n.toLowerCase() + "@example.com", n, "ALIVE");
        }
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
    }

    private String targetEmail(String assassinEmail) {
        return jdbc.queryForObject("""
                select t.email from game.assignment a
                  join game.player me on me.id = a.assassin_id
                  join game.player t on t.id = a.target_id
                 where a.status = 'ACTIVE' and me.email = ?
                """, String.class, assassinEmail);
    }

    private String send(String with, String body) {
        return "{\"with\": \"" + with + "\", \"body\": \"" + body + "\"}";
    }

    @Test
    void requiresAuth() throws Exception {
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(get(base + "/unread-count")).andExpect(status().isUnauthorized());
        mvc.perform(post(base).contentType(MediaType.APPLICATION_JSON).content(send("TARGET", "hi")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void nonPlayerGetsNotInGame() throws Exception {
        mvc.perform(as("stranger@example.com", get(base))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
        mvc.perform(as("stranger@example.com", get(base + "/unread-count"))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
        mvc.perform(as("stranger@example.com", post(base).contentType(MediaType.APPLICATION_JSON)
                .content(send("TARGET", "hi")))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
        mvc.perform(as("stranger@example.com", post(base + "/read").contentType(MediaType.APPLICATION_JSON)
                .content("{\"with\": \"TARGET\"}"))).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void sendReadAndCountRoundTrip() throws Exception {
        String assassin = "alice@example.com";
        String target = targetEmail(assassin);

        mvc.perform(as(assassin, post(base).contentType(MediaType.APPLICATION_JSON).content(send("TARGET", " hello "))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.body").value("hello"))
                .andExpect(jsonPath("$.mine").value(true));

        mvc.perform(as(target, get(base + "/unread-count"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(1));
        mvc.perform(as(target, get(base))).andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.with=='ASSASSIN')].messages[0].body").value("hello"))
                .andExpect(jsonPath("$[?(@.with=='ASSASSIN')].messages[0].mine").value(false))
                .andExpect(jsonPath("$[0].messages[0].senderId").doesNotExist());

        mvc.perform(as(target, post(base + "/read").contentType(MediaType.APPLICATION_JSON)
                .content("{\"with\": \"ASSASSIN\"}"))).andExpect(status().isNoContent());
        mvc.perform(as(target, get(base + "/unread-count"))).andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void errorCodes() throws Exception {
        mvc.perform(as("alice@example.com", post(base).contentType(MediaType.APPLICATION_JSON)
                .content(send("TARGET", "   ")))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MESSAGE"));
        mvc.perform(as("alice@example.com", post(base).contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\": \"hi\"}"))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MESSAGE"));

        for (int i = 0; i < 5; i++) {
            mvc.perform(as("alice@example.com", post(base).contentType(MediaType.APPLICATION_JSON)
                    .content(send("TARGET", "m" + i)))).andExpect(status().isCreated());
        }
        mvc.perform(as("alice@example.com", post(base).contentType(MediaType.APPLICATION_JSON)
                .content(send("TARGET", "too many")))).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void noActivePairingIs409() throws Exception {
        String other = insertGame("Late game", "LATE01", "SETUP", true);
        insertPlayer(other, "alice@example.com", "Alice", "ALIVE");
        mvc.perform(as("alice@example.com", post("/api/me/games/" + other + "/messages")
                .contentType(MediaType.APPLICATION_JSON).content(send("TARGET", "hi"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NO_ACTIVE_PAIRING"));
        mvc.perform(as("alice@example.com", get("/api/me/games/" + other + "/messages")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
    }
}
