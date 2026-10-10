-- Append-only points ledger. One row per point event; points is the delta actually awarded.
create table game.point_event (
    id            bigint generated always as identity primary key,
    game_id       uuid        not null references game.game (id),
    game_round_id uuid,
    player_id     uuid        not null,
    points        integer     not null,
    type          text        not null,
    kill_id       bigint references game.kill (id),
    created_at    timestamptz not null default now(),
    created_by    text,
    constraint point_event_player_fk foreign key (player_id, game_id) references game.player (id, game_id),
    constraint point_event_game_round_fk foreign key (game_round_id, game_id) references game.game_round (id, game_id),
    constraint point_event_type_ck check (type in ('KILL', 'DEATH'))
);

-- A kill can't score twice for the same player.
create unique index point_event_kill_player_uq on game.point_event (kill_id, player_id) where kill_id is not null;
create index point_event_game_player_idx on game.point_event (game_id, player_id);

alter table game.point_event enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.point_event from %I', r);
        end if;
    end loop;
end
$$;
