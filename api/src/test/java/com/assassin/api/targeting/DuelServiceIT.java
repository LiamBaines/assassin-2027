package com.assassin.api.targeting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.assassin.api.IntegrationTest;
import com.assassin.api.JwtTestSupport;
import com.assassin.api.common.ApiException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

class DuelServiceIT extends IntegrationTest {

    @Autowired
    private DuelService service;

    private String gameId;
    private UUID alice;
    private UUID bob;
    private UUID carol;

    @BeforeEach
    void seed() throws Exception {
        gameId = insertGame("ABC123", "SETUP", true);
        alice = insertPlayer(gameId, "alice@example.com", "Alice", "ALIVE");
        bob = insertPlayer(gameId, "bob@example.com", "Bob", "ALIVE");
        carol = insertPlayer(gameId, "carol@example.com", "Carol", "ALIVE");
        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
    }

    private UUID auth(UUID player) {
        return JwtTestSupport.subFor(jdbc.queryForObject("select email from game.player where id = ?", String.class,
                player));
    }

    private UUID targetOf(UUID assassin) {
        return jdbc.queryForObject("select target_id from game.assignment where assassin_id = ? and status = 'ACTIVE'",
                UUID.class, assassin);
    }

    private UUID assassinOf(UUID target) {
        return jdbc.queryForObject("select assassin_id from game.assignment where target_id = ? and status = 'ACTIVE'",
                UUID.class, target);
    }

    private long challenge(UUID assassin, String activity) {
        return service.challenge(gameId, auth(assassin), activity).id();
    }

    private String statusOf(long duelId) {
        return jdbc.queryForObject("select status from game.duel where id = ?", String.class, duelId);
    }

    private void assertCode(Runnable call, String code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo(code));
    }

    @Test
    void challengeCreatesPendingDuelAndThreadMessage() {
        UUID target = targetOf(alice);
        long id = challenge(alice, "  Rock paper scissors ");

        assertThat(statusOf(id)).isEqualTo("PENDING");
        assertThat(jdbc.queryForMap("select challenger_id, challenged_id, activity, kill_method_id from game.duel"))
                .containsEntry("challenger_id", alice).containsEntry("challenged_id", target)
                .containsEntry("activity", "Rock paper scissors")
                .containsEntry("kill_method_id", methodId(gameId, "Duel"));
        assertThat(jdbc.queryForMap("select kind, sender_id, body, duel_id from game.message"))
                .containsEntry("kind", "DUEL").containsEntry("sender_id", alice)
                .containsEntry("body", "Rock paper scissors").containsEntry("duel_id", id);
    }

    @Test
    void challengeRejectsBadActivity() {
        assertCode(() -> challenge(alice, "   "), "INVALID_ACTIVITY");
        assertCode(() -> challenge(alice, "x".repeat(81)), "INVALID_ACTIVITY");
        assertThat(challenge(alice, "x".repeat(80))).isPositive();
    }

    @Test
    void challengeNeedsAnEnabledDuelMethod() {
        jdbc.update("update game.kill_method set enabled = false where game_id = ? and name = 'Duel'", gameId);
        assertCode(() -> challenge(alice, "Chess"), "DUEL_NOT_AVAILABLE");

        jdbc.update("update game.kill_method set enabled = true, name = 'duel' where game_id = ? and name = 'Duel'",
                gameId);
        assertThat(challenge(alice, "Chess")).isPositive();

        jdbc.update("update game.kill_method set name = 'Fisticuffs' where game_id = ? and name = 'duel'", gameId);
        assertCode(() -> challenge(bob, "Chess"), "DUEL_NOT_AVAILABLE");
    }

    @Test
    void challengeNeedsATarget() {
        jdbc.update("update game.player set status = 'DEAD' where id = ?", alice);
        assertCode(() -> challenge(alice, "Chess"), "NO_TARGET");
    }

    @Test
    void onlyOneOpenDuelPerAssassin() {
        long first = challenge(alice, "Chess");
        assertCode(() -> challenge(alice, "Darts"), "DUEL_ALREADY_OPEN");

        service.decline(gameId, first, auth(targetOf(alice)));
        assertThat(challenge(alice, "Darts")).isNotEqualTo(first);
    }

    @Test
    void acceptMovesToAccepted() {
        long id = challenge(alice, "Chess");
        assertThat(service.accept(gameId, id, auth(targetOf(alice))).status()).isEqualTo(DuelStatus.ACCEPTED);
        assertThat(jdbc.queryForObject("select accepted_at is not null from game.duel", Boolean.class)).isTrue();
        assertCode(() -> challenge(alice, "Darts"), "DUEL_ALREADY_OPEN");
    }

    @Test
    void declineClosesTheDuel() {
        long id = challenge(alice, "Chess");
        assertThat(service.decline(gameId, id, auth(targetOf(alice))).status()).isEqualTo(DuelStatus.DECLINED);
        assertThat(jdbc.queryForObject("select resolved_at is not null from game.duel", Boolean.class)).isTrue();
    }

    @Test
    void revokeWorksOnlyWhilePending() {
        long id = challenge(alice, "Chess");
        assertThat(service.revoke(gameId, id, auth(alice)).status()).isEqualTo(DuelStatus.REVOKED);

        long second = challenge(alice, "Darts");
        service.accept(gameId, second, auth(targetOf(alice)));
        assertCode(() -> service.revoke(gameId, second, auth(alice)), "DUEL_NOT_OPEN");
        assertThat(statusOf(second)).isEqualTo("ACCEPTED");
    }

    @Test
    void answeringTwiceIsRejected() {
        long id = challenge(alice, "Chess");
        UUID target = auth(targetOf(alice));
        service.accept(gameId, id, target);
        assertCode(() -> service.accept(gameId, id, target), "DUEL_NOT_OPEN");
        assertCode(() -> service.decline(gameId, id, target), "DUEL_NOT_OPEN");
    }

    @Test
    void onlyTheRightParticipantCanAct() {
        long id = challenge(alice, "Chess");
        UUID target = targetOf(alice);
        UUID bystander = assassinOf(alice); // in a 3-ring this is the target's other neighbour
        assertThat(bystander).isNotEqualTo(target);

        assertCode(() -> service.accept(gameId, id, auth(alice)), "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.decline(gameId, id, auth(alice)), "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.revoke(gameId, id, auth(target)), "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.accept(gameId, id, auth(bystander)), "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.revoke(gameId, id, auth(bystander)), "NOT_DUEL_PARTICIPANT");
        assertThat(statusOf(id)).isEqualTo("PENDING");
    }

    @Test
    void unknownDuelIs404() {
        assertThatThrownBy(() -> service.accept(gameId, 999, auth(alice))).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("DUEL_NOT_FOUND"));
    }

    // --- result flow ---

    private long acceptedDuel(UUID challenger) {
        long id = challenge(challenger, "Chess");
        service.accept(gameId, id, auth(targetOf(challenger)));
        return id;
    }

    private int points(UUID player) {
        return jdbc.queryForObject("select coalesce(sum(points), 0) from game.point_event where player_id = ?",
                Integer.class, player);
    }

    private String playerStatus(UUID player) {
        return jdbc.queryForObject("select status from game.player where id = ?", String.class, player);
    }

    @Test
    void challengerWinningIsAnOrdinaryKill() {
        UUID target = targetOf(alice);
        UUID target2 = targetOf(target);
        long id = acceptedDuel(alice);

        service.report(gameId, id, auth(alice), DuelService.Winner.ME);
        assertThat(statusOf(id)).isEqualTo("REPORTED");
        DuelService.DuelResult result = service.confirm(gameId, id, auth(target));

        assertThat(result.status()).isEqualTo(DuelStatus.COMPLETED);
        assertThat(statusOf(id)).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForMap("select killer_id, victim_id, kill_method_id from game.kill"))
                .containsEntry("killer_id", alice).containsEntry("victim_id", target)
                .containsEntry("kill_method_id", methodId(gameId, "Duel"));
        assertThat(jdbc.queryForObject("select kill_id from game.duel", Long.class)).isEqualTo(result.killId());
        assertThat(playerStatus(target)).isEqualTo("DEAD");
        assertThat(targetOf(alice)).isEqualTo(target2);
        assertThat(points(alice)).isEqualTo(15);
        assertThat(points(target)).isEqualTo(-5);
    }

    @Test
    void challengedWinningKillsTheChallengerAndReSplicesTheRing() {
        UUID target = targetOf(alice);
        UUID assassin = assassinOf(alice);
        long id = acceptedDuel(alice);

        // The challenged player reports; the challenger confirms.
        service.report(gameId, id, auth(target), DuelService.Winner.ME);
        service.confirm(gameId, id, auth(alice));

        assertThat(jdbc.queryForMap("select killer_id, victim_id from game.kill"))
                .containsEntry("killer_id", target).containsEntry("victim_id", alice);
        assertThat(playerStatus(alice)).isEqualTo("DEAD");
        assertThat(playerStatus(target)).isEqualTo("ALIVE");
        assertThat(targetOf(assassin)).isEqualTo(target);
        assertThat(targetOf(target)).isEqualTo(assassin); // the winner's own target is unchanged
        assertThat(points(target)).isEqualTo(15);
        assertThat(points(alice)).isEqualTo(-5);
        assertThat(statusOf(id)).isEqualTo("COMPLETED");

        long newAssignment = jdbc.queryForObject(
                "select id from game.assignment where assassin_id = ? and status = 'ACTIVE'", Long.class, assassin);
        assertThat(jdbc.queryForMap("select kind, assignment_id, sender_id, body from game.message where kind = 'SYSTEM'"))
                .containsEntry("assignment_id", newAssignment).containsEntry("sender_id", null)
                .containsEntry("body", "Your target has changed.");
    }

    @Test
    void contestedDuelIsDecidedByTheAdmin() {
        UUID target = targetOf(alice);
        long id = acceptedDuel(alice);

        service.report(gameId, id, auth(alice), DuelService.Winner.ME);
        assertThat(service.contest(gameId, id, auth(target)).status()).isEqualTo(DuelStatus.CONTESTED);
        assertCode(() -> service.confirm(gameId, id, auth(target)), "DUEL_NOT_OPEN");

        DuelService.DuelResult result = service.adminResolve(gameId, id, target, "admin@e2e.test");
        assertThat(result.status()).isEqualTo(DuelStatus.COMPLETED);
        assertThat(jdbc.queryForMap("select killer_id, victim_id, registered_by from game.kill"))
                .containsEntry("killer_id", target).containsEntry("victim_id", alice)
                .containsEntry("registered_by", "admin@e2e.test");
        assertThat(jdbc.queryForObject("select resolved_by from game.duel", String.class)).isEqualTo("admin@e2e.test");
    }

    @Test
    void adminCanResolveAPendingDuelButOnlyToADuellist() {
        long id = challenge(alice, "Chess");
        assertCode(() -> service.adminResolve(gameId, id, assassinOf(alice), "a@x"), "INVALID_WINNER");
        service.adminResolve(gameId, id, alice, "a@x");
        assertThat(statusOf(id)).isEqualTo("COMPLETED");
        assertCode(() -> service.adminResolve(gameId, id, alice, "a@x"), "DUEL_NOT_OPEN");
    }

    @Test
    void reportAndConfirmRulesAreEnforced() {
        UUID target = targetOf(alice);
        long pending = challenge(alice, "Chess");
        assertCode(() -> service.report(gameId, pending, auth(alice), DuelService.Winner.ME), "DUEL_NOT_OPEN");

        service.accept(gameId, pending, auth(target));
        assertCode(() -> service.report(gameId, pending, auth(assassinOf(alice)), DuelService.Winner.ME),
                "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.confirm(gameId, pending, auth(target)), "DUEL_NOT_OPEN");

        service.report(gameId, pending, auth(alice), DuelService.Winner.OTHER);
        assertCode(() -> service.confirm(gameId, pending, auth(alice)), "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.contest(gameId, pending, auth(alice)), "NOT_DUEL_PARTICIPANT");
        assertCode(() -> service.report(gameId, pending, auth(target), DuelService.Winner.ME), "DUEL_NOT_OPEN");

        // "OTHER" from the challenger means the challenged player won.
        service.confirm(gameId, pending, auth(target));
        assertThat(jdbc.queryForObject("select killer_id from game.kill", UUID.class)).isEqualTo(target);
    }

    @Test
    void resolvingAStaleDuelFails() {
        long id = acceptedDuel(alice);
        jdbc.update("update game.assignment set status = 'SUPERSEDED' where assassin_id = ? and status = 'ACTIVE'",
                alice);
        assertCode(() -> service.adminResolve(gameId, id, alice, "a@x"), "DUEL_STALE");
        assertThat(jdbc.queryForObject("select count(*) from game.kill", Integer.class)).isZero();
    }

    @Test
    void targetWinningInATwoPlayerRingEndsTheRound() throws Exception {
        String g2 = insertGame("TWO222", "SETUP", true);
        UUID dan = insertPlayer(g2, "dan@example.com", "Dan", "ALIVE");
        UUID eve = insertPlayer(g2, "eve@example.com", "Eve", "ALIVE");
        mvc.perform(asAdmin(post("/api/admin/games/" + g2 + "/rings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedCurrentRoundNo\": null}"))).andExpect(status().isCreated());
        long id = service.challenge(g2, auth(dan), "Chess").id();
        service.accept(g2, id, auth(eve));

        DuelService.DuelResult result = service.adminResolve(g2, id, eve, "a@x");

        assertThat(result.roundEnded()).isTrue();
        assertThat(jdbc.queryForObject("select winner_id from game.game_round where game_id = ?", UUID.class, g2))
                .isEqualTo(eve);
        assertThat(jdbc.queryForObject("select count(*) from game.message where kind = 'SYSTEM'", Integer.class))
                .isZero();
    }

    // --- voiding ---

    @Autowired
    private KillService killService;

    @Autowired
    private KillClaimService claimService;

    private long killMethod() {
        return methodId(gameId, "Duel");
    }

    @Test
    void adminKillOfTheTargetVoidsItsOpenDuels() {
        UUID target = targetOf(alice);
        UUID assassin = assassinOf(alice);
        long mine = acceptedDuel(alice);
        long onMe = acceptedDuel(assassin);
        long targets = acceptedDuel(target);

        killService.register(gameId, target, killMethod(), "a@x");

        assertThat(statusOf(mine)).isEqualTo("VOIDED");
        assertThat(statusOf(targets)).isEqualTo("VOIDED");
        assertThat(statusOf(onMe)).isEqualTo("ACCEPTED"); // assassin -> alice is untouched
    }

    @Test
    void adminKillOfAnUninvolvedPlayerLeavesTheDuelAlone() {
        // In a three-player ring everyone is involved, so use four.
        UUID dan = insertPlayer(gameId, "dan@example.com", "Dan", "ALIVE");
        mvcReshuffle();
        UUID target = targetOf(alice);
        UUID other = java.util.stream.Stream.of(alice, bob, carol, dan)
                .filter(p -> !p.equals(alice) && !p.equals(target) && !p.equals(assassinOf(alice))).findFirst().get();
        long id = challenge(alice, "Chess");

        killService.register(gameId, other, killMethod(), "a@x");

        assertThat(statusOf(id)).isEqualTo("PENDING");
    }

    @Test
    void aNormalClaimThatIsAcceptedVoidsTheDuel() {
        UUID target = targetOf(alice);
        long id = acceptedDuel(alice);
        long claimMethod = methodId(gameId, "Clamp");

        long claim = claimService.file(gameId, auth(alice), claimMethod).id();
        claimService.accept(gameId, claim, auth(target));

        assertThat(statusOf(id)).isEqualTo("VOIDED");
        assertCode(() -> service.report(gameId, id, auth(alice), DuelService.Winner.ME), "DUEL_NOT_OPEN");
    }

    @Test
    void aShakeupVoidsOpenDuelsAndAllowsANewOne() throws Exception {
        long id = acceptedDuel(alice);

        mvcReshuffle();

        assertThat(statusOf(id)).isEqualTo("VOIDED");
        challenge(alice, "Chess"); // no longer blocked by the voided duel
    }

    @Test
    void aNewRoundVoidsOpenDuels() throws Exception {
        long id = challenge(alice, "Chess");

        mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rounds").contentType(MediaType.APPLICATION_JSON)
                .content("{\"expectedRoundNo\": 1, \"playerIds\": [\"" + alice + "\", \"" + bob + "\", \""
                        + carol + "\"]}"))).andExpect(status().isCreated());

        assertThat(statusOf(id)).isEqualTo("VOIDED");
    }

    @Test
    void aCompletedDuelIsNotVoidedByItsOwnKill() {
        long id = acceptedDuel(alice);
        service.adminResolve(gameId, id, alice, "a@x");
        assertThat(statusOf(id)).isEqualTo("COMPLETED");
    }

    private void mvcReshuffle() {
        try {
            mvc.perform(asAdmin(post("/api/admin/games/" + gameId + "/rings").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"expectedCurrentRoundNo\": 1}"))).andExpect(status().isCreated());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
