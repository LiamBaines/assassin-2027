package com.assassin.api.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import com.assassin.api.common.ApiException;
import com.assassin.api.message.MessageService.Counterpart;
import com.assassin.api.message.MessageService.ThreadView;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class MessageServiceIT extends IntegrationTest {

    @Autowired
    private MessageService service;

    private String gameId;
    private List<UUID> players;

    @BeforeEach
    void seed() {
        gameId = insertGame("ABC123", "SETUP", true);
        players = List.of(
                insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE"),
                insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE"),
                insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE"),
                insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE"));
    }

    private void shuffle(Integer expectedRound) throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": " + expectedRound + "}"))).andExpect(status().isCreated());
    }

    private void kill(UUID victim) throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kills").contentType(MediaType.APPLICATION_JSON)
                .content("{\"victimId\": \"" + victim + "\", \"killMethodId\": " + methodId(gameId, "Clamp") + "}")))
                .andExpect(status().isCreated());
    }

    private String email(UUID playerId) {
        return jdbc.queryForObject("select email from game.player where id = ?", String.class, playerId);
    }

    private UUID targetOf(UUID assassin) {
        return jdbc.queryForObject("select target_id from game.assignment where assassin_id = ? and status = 'ACTIVE'",
                UUID.class, assassin);
    }

    private UUID assassinOf(UUID target) {
        return jdbc.queryForObject("select assassin_id from game.assignment where target_id = ? and status = 'ACTIVE'",
                UUID.class, target);
    }

    private UUID auth(UUID playerId) {
        return JwtTestSupport.subFor(email(playerId));
    }

    private ThreadView thread(UUID playerId, Counterpart with) {
        return service.threads(gameId, auth(playerId)).stream().filter(t -> t.with() == with).findFirst()
                .orElseThrow();
    }

    private void assertCode(Runnable call, String code) {
        assertThatThrownBy(call::run).isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(code);
    }

    @Test
    void assassinAndTargetCanMessageEachOther() throws Exception {
        shuffle(null);
        UUID assassin = players.getFirst();
        UUID target = targetOf(assassin);

        service.send(gameId, auth(assassin), Counterpart.TARGET, "  look under your chair ");

        ThreadView seenByTarget = thread(target, Counterpart.ASSASSIN);
        assertThat(seenByTarget.messages()).singleElement().satisfies(m -> {
            assertThat(m.body()).isEqualTo("look under your chair");
            assertThat(m.mine()).isFalse();
        });
        assertThat(seenByTarget.unread()).isEqualTo(1);
        assertThat(service.unreadCount(gameId, auth(target))).isEqualTo(1);
        assertThat(service.unreadCount(gameId, auth(assassin))).isZero();
        assertThat(thread(assassin, Counterpart.TARGET).messages()).singleElement()
                .satisfies(m -> assertThat(m.mine()).isTrue());

        service.send(gameId, auth(target), Counterpart.ASSASSIN, "come get me!");
        assertThat(thread(assassin, Counterpart.TARGET).unread()).isEqualTo(1);
        assertThat(service.unreadCount(gameId, auth(assassin))).isEqualTo(1);
    }

    @Test
    void markReadClearsOnlyTheOpenedThread() throws Exception {
        shuffle(null);
        UUID me = players.getFirst();
        service.send(gameId, auth(targetOf(me)), Counterpart.ASSASSIN, "from my target");
        service.send(gameId, auth(assassinOf(me)), Counterpart.TARGET, "from my assassin");
        assertThat(service.unreadCount(gameId, auth(me))).isEqualTo(2);

        service.markRead(gameId, auth(me), Counterpart.TARGET);

        assertThat(service.unreadCount(gameId, auth(me))).isEqualTo(1);
        assertThat(thread(me, Counterpart.TARGET).messages()).singleElement()
                .satisfies(m -> assertThat(m.read()).isTrue());
        assertThat(thread(me, Counterpart.ASSASSIN).unread()).isEqualTo(1);
    }

    @Test
    void noRingMeansNoPairing() {
        assertThat(service.threads(gameId, auth(players.getFirst()))).isEmpty();
        assertCode(() -> service.send(gameId, auth(players.getFirst()), Counterpart.TARGET, "hi"),
                "NO_ACTIVE_PAIRING");
    }

    @Test
    void nonPlayerIsNotInGame() {
        assertCode(() -> service.threads(gameId, JwtTestSupport.subFor("stranger@example.com")), "NOT_IN_GAME");
    }

    @Test
    void rejectsBlankAndOverlongBodies() throws Exception {
        shuffle(null);
        UUID me = auth(players.getFirst());
        assertCode(() -> service.send(gameId, me, Counterpart.TARGET, "   "), "INVALID_MESSAGE");
        assertCode(() -> service.send(gameId, me, Counterpart.TARGET, null), "INVALID_MESSAGE");
        assertCode(() -> service.send(gameId, me, Counterpart.TARGET, "x".repeat(281)), "INVALID_MESSAGE");
        service.send(gameId, me, Counterpart.TARGET, "x".repeat(280));
    }

    @Test
    void rateLimitsPerSenderPerPairing() throws Exception {
        shuffle(null);
        UUID assassin = players.getFirst();
        for (int i = 0; i < 5; i++) {
            service.send(gameId, auth(assassin), Counterpart.TARGET, "ping " + i);
        }
        assertCode(() -> service.send(gameId, auth(assassin), Counterpart.TARGET, "one more"), "RATE_LIMITED");
        // The other side has its own allowance.
        service.send(gameId, auth(targetOf(assassin)), Counterpart.ASSASSIN, "hello");
    }

    @Test
    void killEndsTheThreadAndTheNewTargetStartsEmpty() throws Exception {
        shuffle(null);
        UUID assassin = players.getFirst();
        UUID victim = targetOf(assassin);
        UUID nextTarget = targetOf(victim);
        UUID assassinOfAssassin = assassinOf(assassin);
        service.send(gameId, auth(assassin), Counterpart.TARGET, "to the victim");
        service.send(gameId, auth(assassinOfAssassin), Counterpart.TARGET, "to the assassin");

        kill(victim);

        assertThat(thread(assassin, Counterpart.TARGET).messages()).isEmpty();
        assertThat(targetOf(assassin)).isEqualTo(nextTarget);
        // The thread with the assassin's own assassin is untouched by the kill.
        assertThat(thread(assassin, Counterpart.ASSASSIN).messages()).singleElement()
                .satisfies(m -> assertThat(m.body()).isEqualTo("to the assassin"));
        // The dead player has no live threads and can't send.
        assertThat(service.threads(gameId, auth(victim))).isEmpty();
        assertThat(service.unreadCount(gameId, auth(victim))).isZero();
        assertCode(() -> service.send(gameId, auth(victim), Counterpart.TARGET, "ghost"), "NO_ACTIVE_PAIRING");
        // Ended messages are kept for admins.
        assertThat(jdbc.queryForObject("select count(*) from game.message where body = 'to the victim'",
                Integer.class)).isEqualTo(1);
    }

    @Test
    void shakeupStartsEveryThreadEmpty() throws Exception {
        shuffle(null);
        service.send(gameId, auth(players.getFirst()), Counterpart.TARGET, "before the shakeup");
        shuffle(1);
        for (UUID p : players) {
            assertThat(service.threads(gameId, auth(p))).allSatisfy(t -> assertThat(t.messages()).isEmpty());
            assertThat(service.unreadCount(gameId, auth(p))).isZero();
        }
    }

    @Test
    void deletedMessagesAreHiddenFromPlayers() throws Exception {
        shuffle(null);
        UUID assassin = players.getFirst();
        service.send(gameId, auth(assassin), Counterpart.TARGET, "oops");
        jdbc.update("update game.message set deleted_at = now()");
        assertThat(thread(assassin, Counterpart.TARGET).messages()).isEmpty();
        assertThat(service.unreadCount(gameId, auth(targetOf(assassin)))).isZero();
    }
}
