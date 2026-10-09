-- Kill log. One row per death; assignment_id is the killer -> victim assignment that the kill completed.
create table game.kill (
    id            bigint generated always as identity primary key,
    game_id       uuid        not null references game.game (id),
    assignment_id bigint      not null references game.assignment (id),
    killer_id     uuid        not null,
    victim_id     uuid        not null,
    registered_by text        not null,
    created_at    timestamptz not null default now(),
    constraint kill_killer_fk foreign key (killer_id, game_id) references game.player (id, game_id),
    constraint kill_victim_fk foreign key (victim_id, game_id) references game.player (id, game_id),
    constraint kill_not_self_ck check (killer_id <> victim_id),
    -- A player dies once.
    constraint kill_victim_uq unique (victim_id)
);

create index kill_game_idx on game.kill (game_id);

alter table game.kill enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.kill from %I', r);
        end if;
    end loop;
end
$$;
