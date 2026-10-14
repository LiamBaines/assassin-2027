-- Append-only log of everything that happened in a game. Names are snapshotted into the payload.
-- No type check constraint: new event types shouldn't need a migration.
create table game.game_event (
    id         bigint generated always as identity primary key,
    game_id    uuid        not null references game.game (id),
    type       text        not null,
    payload    jsonb       not null,
    created_at timestamptz not null default now()
);

create index game_event_game_id_idx on game.game_event (game_id, id desc);

alter table game.game_event enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.game_event from %I', r);
        end if;
    end loop;
end
$$;
