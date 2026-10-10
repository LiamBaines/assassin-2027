package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class KillClaimIT extends IntegrationTest {

    private UUID gameId;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void seed() {
        gameId = insertGame("ABC123", "SETUP", true);
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        carol = insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
    }

    private void shuffle() throws Exception {
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
    }

    private String emailOf(UUID player) {
        return jdbc.queryForObject("select email from game.player where id = ?", String.class, player);
    }

    private UUID targetOf(UUID assassin) {
        return jdbc.queryForObject(
                "select target_id from game.assignment where assassin_id = ? and status = 'ACTIVE'", UUID.class,
                assassin);
    }

    private String claimUrl(String suffix) {
        return "/api/me/games/" + gameId + "/kill-claims" + suffix;
    }

    private ResultActions meGet(UUID player, String suffix) throws Exception {
        return mvc.perform(as(emailOf(player), get(claimUrl(suffix))));
    }

    private ResultActions mePost(UUID player, String suffix) throws Exception {
        return mvc.perform(as(emailOf(player), post(claimUrl(suffix))));
    }

    private ResultActions file(UUID killer) throws Exception {
        return mePost(killer, "");
    }

    private long fileOk(UUID killer) throws Exception {
        file(killer).andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"));
        return jdbc.queryForObject("select max(id) from game.kill_claim", Long.class);
    }

    private ResultActions admin(String suffix, long id) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kill-claims/" + id + suffix)));
    }

    private ResultActions adminKill(UUID victim) throws Exception {
        return mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/kills")
                .contentType(MediaType.APPLICATION_JSON).content("{\"victimId\": \"" + victim + "\"}")));
    }

    private String claimStatus(long id) {
        return jdbc.queryForObject("select status from game.kill_claim where id = ?", String.class, id);
    }

    private String string(String sql, Object... args) {
        return jdbc.queryForObject(sql, String.class, args);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    @Test
    void fileCreatesPendingClaimAgainstCurrentTarget() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        assertThat(count("select count(*) from game.kill_claim where id = ? and killer_id = ? and victim_id = ?",
                id, alice, victim)).isEqualTo(1);
        meGet(alice, "/mine").andExpect(jsonPath("$.outgoing.id").value(id))
                .andExpect(jsonPath("$.outgoing.status").value("PENDING"))
                .andExpect(jsonPath("$.incoming").value(nullValue()));
        meGet(victim, "/mine").andExpect(jsonPath("$.incoming.id").value(id))
                .andExpect(jsonPath("$.incoming.killerName").value("Alice"))
                .andExpect(jsonPath("$.outgoing").value(nullValue()));
    }

    @Test
    void secondOpenClaimAgainstSameVictimIsRejected() throws Exception {
        shuffle();
        fileOk(alice);
        file(alice).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CLAIM_ALREADY_OPEN"));
        assertThat(count("select count(*) from game.kill_claim")).isEqualTo(1);
    }

    @Test
    void playerWithoutTargetCannotFile() throws Exception {
        shuffle();
        UUID dave = insertPlayer(gameId, "dave@example.com", "Dave", "ALIVE");
        file(dave).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NO_TARGET"));
    }

    @Test
    void nonPlayerIsNotInGame() throws Exception {
        shuffle();
        mvc.perform(as("stranger@example.com", post(claimUrl(""))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_IN_GAME"));
    }

    @Test
    void gameThatHasNotStartedIsRejected() throws Exception {
        file(alice).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_NOT_STARTED"));
    }

    @Test
    void finishedGameIsRejected() throws Exception {
        shuffle();
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now() where id = ?", gameId);
        file(alice).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_FINISHED"));
    }

    @Test
    void acceptConfirmsKillAndSplicesRing() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        UUID inherited = targetOf(victim);
        long id = fileOk(alice);

        mePost(victim, "/" + id + "/accept").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.roundEnded").value(false));

        assertThat(claimStatus(id)).isEqualTo("CONFIRMED");
        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("DEAD");
        assertActiveRingCovers(List.of(alice, inherited));
        assertThat(targetOf(alice)).isEqualTo(inherited);
        assertThat(count("select count(*) from game.kill where killer_id = ? and victim_id = ? and registered_by = ?",
                alice, victim, emailOf(victim))).isEqualTo(1);
        assertThat(count("select count(*) from game.kill_claim c join game.kill k on k.id = c.kill_id "
                + "where c.id = ? and c.resolved_by = ?", id, emailOf(victim))).isEqualTo(1);
    }

    @Test
    void acceptInLastTwoEndsRound() throws Exception {
        shuffle();
        adminKill(carol).andExpect(status().isCreated());
        UUID killer = jdbc.queryForObject("select killer_id from game.kill", UUID.class);
        UUID victim = targetOf(killer);
        long id = fileOk(killer);

        mePost(victim, "/" + id + "/accept").andExpect(status().isOk())
                .andExpect(jsonPath("$.roundEnded").value(true));

        assertThat(string("select status from game.game where id = ?", gameId)).isEqualTo("ACTIVE");
        assertThat(count("select count(*) from game.game_round where ended_at is not null and winner_id is not null"))
                .isEqualTo(1);
        assertThat(count("select count(*) from game.assignment where status = 'ACTIVE'")).isZero();
    }

    @Test
    void contestedClaimStaysOpenAndVictimCannotChangeAnswer() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        mePost(victim, "/" + id + "/contest").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONTESTED"));
        mePost(victim, "/" + id + "/accept").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLAIM_NOT_OPEN"));
        meGet(victim, "/mine").andExpect(jsonPath("$.incoming").value(nullValue()));
        meGet(alice, "/mine").andExpect(jsonPath("$.outgoing.status").value("CONTESTED"));
        file(alice).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CLAIM_ALREADY_OPEN"));
    }

    @Test
    void adminConfirmsContestedClaim() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);
        mePost(victim, "/" + id + "/contest").andExpect(status().isOk());

        admin("/confirm", id).andExpect(status().isOk())
                .andExpect(jsonPath("$.killer.id").value(alice.toString()))
                .andExpect(jsonPath("$.victim.id").value(victim.toString()))
                .andExpect(jsonPath("$.roundEnded").value(false));

        assertThat(claimStatus(id)).isEqualTo("CONFIRMED");
        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("DEAD");
        assertThat(count("select count(*) from game.kill where registered_by = ?", JwtTestSupport.ADMIN_EMAIL))
                .isEqualTo(1);
    }

    @Test
    void adminConfirmsBeforeVictimResponds() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        admin("/confirm", id).andExpect(status().isOk());

        assertThat(claimStatus(id)).isEqualTo("CONFIRMED");
        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("DEAD");
    }

    @Test
    void adminDismissesContestedClaimAndKillerCanFileAgain() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);
        mePost(victim, "/" + id + "/contest").andExpect(status().isOk());

        admin("/dismiss", id).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DISMISSED"));

        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("ALIVE");
        meGet(alice, "/mine").andExpect(jsonPath("$.outgoing.status").value("DISMISSED"));
        long second = fileOk(alice);
        assertThat(second).isGreaterThan(id);
    }

    @Test
    void adminListShowsOpenClaimsOnly() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long dismissed = fileOk(alice);
        admin("/dismiss", dismissed).andExpect(status().isOk());
        long open = fileOk(alice);

        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/kill-claims?status=open")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(open))
                .andExpect(jsonPath("$[0].status").value("PENDING"))
                .andExpect(jsonPath("$[0].killerName").value("Alice"))
                .andExpect(jsonPath("$[0].victimName").value(string(
                        "select display_name from game.player where id = ?", victim)));
    }

    @Test
    void adminEndpointsRequireAdmin() throws Exception {
        shuffle();
        long id = fileOk(alice);
        mvc.perform(as("alice@example.com", get("/api/admin/games/" + gameId + "/kill-claims")))
                .andExpect(status().isForbidden());
        mvc.perform(as("alice@example.com", post("/api/admin/games/" + gameId + "/kill-claims/" + id + "/confirm")))
                .andExpect(status().isForbidden());
        assertThat(claimStatus(id)).isEqualTo("PENDING");
    }

    @Test
    void killerCanWithdrawOpenClaim() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        mePost(alice, "/" + id + "/withdraw").andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));

        assertThat(claimStatus(id)).isEqualTo("WITHDRAWN");
        mePost(victim, "/" + id + "/accept").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLAIM_NOT_OPEN"));
        mePost(alice, "/" + id + "/withdraw").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLAIM_NOT_OPEN"));
        meGet(alice, "/mine").andExpect(jsonPath("$.outgoing").value(nullValue()));
    }

    @Test
    void killerCanWithdrawContestedClaim() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);
        mePost(victim, "/" + id + "/contest").andExpect(status().isOk());
        mePost(alice, "/" + id + "/withdraw").andExpect(status().isOk());
        assertThat(claimStatus(id)).isEqualTo("WITHDRAWN");
    }

    @Test
    void wrongParticipantIsForbidden() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        UUID bystander = victim.equals(bob) ? carol : bob;
        long id = fileOk(alice);

        mePost(alice, "/" + id + "/accept").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CLAIM_PARTICIPANT"));
        mePost(alice, "/" + id + "/contest").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CLAIM_PARTICIPANT"));
        mePost(victim, "/" + id + "/withdraw").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CLAIM_PARTICIPANT"));
        mePost(bystander, "/" + id + "/accept").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_CLAIM_PARTICIPANT"));
        assertThat(claimStatus(id)).isEqualTo("PENDING");
    }

    @Test
    void shakeupVoidsOpenClaims() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": 1}"))).andExpect(status().isCreated());

        assertThat(claimStatus(id)).isEqualTo("VOIDED");
        mePost(victim, "/" + id + "/accept").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLAIM_NOT_OPEN"));
        mvc.perform(asAdmin(get("/api/admin/games/" + gameId + "/kill-claims")))
                .andExpect(jsonPath("$.length()").value(0));
        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("ALIVE");
    }

    @Test
    void anotherKillVoidsClaimInvolvingTheKiller() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        adminKill(alice).andExpect(status().isCreated());

        assertThat(claimStatus(id)).isEqualTo("VOIDED");
        admin("/confirm", id).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLAIM_NOT_OPEN"));
        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("ALIVE");
    }

    @Test
    void anotherKillVoidsClaimAgainstTheVictim() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);

        adminKill(victim).andExpect(status().isCreated());

        assertThat(claimStatus(id)).isEqualTo("VOIDED");
        assertThat(count("select count(*) from game.kill")).isEqualTo(1);
    }

    @Test
    void claimOnFinishedGameCannotBeConfirmed() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);
        jdbc.update("update game.game set status = 'FINISHED', finished_at = now() where id = ?", gameId);

        mePost(victim, "/" + id + "/accept").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GAME_FINISHED"));
        admin("/confirm", id).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GAME_FINISHED"));
    }

    @Test
    void staleAssignmentCannotBeConfirmed() throws Exception {
        shuffle();
        UUID victim = targetOf(alice);
        long id = fileOk(alice);
        jdbc.update("update game.assignment set status = 'VOIDED', ended_at = now() "
                + "where assassin_id = ? and status = 'ACTIVE'", alice);

        mePost(victim, "/" + id + "/accept").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CLAIM_STALE"));
        assertThat(claimStatus(id)).isEqualTo("PENDING");
        assertThat(string("select status from game.player where id = ?", victim)).isEqualTo("ALIVE");
    }
}
