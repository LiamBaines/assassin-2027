package com.assassin.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LockdownIT extends IntegrationTest {

    @Test
    void apiRolesHaveNoUsageOnGameSchema() {
        for (String role : List.of("anon", "authenticated")) {
            Boolean usage = jdbc.queryForObject("select has_schema_privilege(?, 'game', 'USAGE')", Boolean.class, role);
            assertThat(usage).as("%s USAGE on schema game", role).isFalse();
        }
    }

    @Test
    void rowLevelSecurityIsEnabledOnEveryGameTable() {
        List<Map<String, Object>> tables = jdbc.queryForList("""
                select c.relname, c.relrowsecurity
                  from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'game' and c.relkind in ('r', 'p')
                   and c.relname <> 'flyway_schema_history'
                """);
        assertThat(tables).extracting(t -> t.get("relname"))
                .contains("game", "player", "assignment_round", "assignment");
        assertThat(tables).allSatisfy(t -> assertThat(t.get("relrowsecurity")).as("%s", t.get("relname")).isEqualTo(true));
    }
}
