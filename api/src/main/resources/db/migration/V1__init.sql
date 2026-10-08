-- Game tables live in schema "game" (created by Flyway via spring.flyway.schemas).

create table game.game (
    id           uuid primary key default gen_random_uuid(),
    name         text        not null check (char_length(name) between 1 and 100),
    join_code    text        not null check (join_code ~ '^[A-Z0-9]{6,16}$'),
    status       text        not null default 'SETUP' check (status in ('SETUP', 'ACTIVE', 'FINISHED')),
    signups_open boolean     not null default true,
    created_at   timestamptz not null default now(),
    started_at   timestamptz,
    finished_at  timestamptz,
    version      bigint      not null default 0
);

-- At most one game that is not FINISHED.
create unique index game_one_live_uq on game.game ((true)) where status <> 'FINISHED';

create table game.player (
    id           uuid primary key default gen_random_uuid(),
    game_id      uuid        not null references game.game (id),
    auth_user_id uuid        not null,
    email        text        not null,
    display_name text        not null check (char_length(display_name) between 2 and 32),
    status       text        not null default 'ALIVE' check (status in ('ALIVE', 'DEAD', 'REMOVED')),
    joined_at    timestamptz not null default now(),
    constraint player_game_auth_user_uq unique (game_id, auth_user_id),
    constraint player_id_game_uq unique (id, game_id)
);

create unique index player_game_display_name_uq on game.player (game_id, lower(display_name));

create table game.assignment_round (
    id           uuid primary key default gen_random_uuid(),
    game_id      uuid        not null references game.game (id),
    round_no     integer     not null check (round_no > 0),
    reason       text        not null check (reason in ('INITIAL', 'SHAKEUP')),
    player_count integer     not null check (player_count >= 2),
    created_by   text        not null,
    created_at   timestamptz not null default now(),
    constraint assignment_round_game_round_no_uq unique (game_id, round_no),
    constraint assignment_round_id_game_uq unique (id, game_id)
);

create table game.assignment (
    id          bigint generated always as identity primary key,
    game_id     uuid        not null references game.game (id),
    round_id    uuid        not null,
    assassin_id uuid        not null,
    target_id   uuid        not null,
    source      text        not null check (source in ('RING', 'KILL_INHERIT', 'SPLICE', 'MANUAL')),
    status      text        not null default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED', 'SUPERSEDED', 'VOIDED')),
    created_at  timestamptz not null default now(),
    ended_at    timestamptz,
    constraint assignment_round_fk foreign key (round_id, game_id) references game.assignment_round (id, game_id),
    constraint assignment_assassin_fk foreign key (assassin_id, game_id) references game.player (id, game_id),
    constraint assignment_target_fk foreign key (target_id, game_id) references game.player (id, game_id),
    constraint assignment_not_self_ck check (assassin_id <> target_id)
);

-- One ACTIVE assignment per assassin, and one assassin per target.
create unique index assignment_active_assassin_uq on game.assignment (assassin_id) where status = 'ACTIVE';
create unique index assignment_active_target_uq on game.assignment (target_id) where status = 'ACTIVE';
create index assignment_game_status_idx on game.assignment (game_id, status);
create index assignment_round_idx on game.assignment (round_id);

-- RLS on with no policies: only the owning role (the API) can touch rows.
alter table game.game enable row level security;
alter table game.player enable row level security;
alter table game.assignment_round enable row level security;
alter table game.assignment enable row level security;
-- Flyway creates its history table in this schema before running V1.
alter table game.flyway_schema_history enable row level security;

-- Lock out the Supabase API roles. Guarded so this also runs on plain Postgres.
do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on schema game from %I', r);
            execute format('revoke all on all tables in schema game from %I', r);
            execute format('revoke all on all sequences in schema game from %I', r);
            execute format('revoke all on all functions in schema game from %I', r);
            execute format('alter default privileges in schema game revoke all on tables from %I', r);
            execute format('alter default privileges in schema game revoke all on sequences from %I', r);
            execute format('alter default privileges in schema game revoke all on functions from %I', r);
        end if;
    end loop;
end
$$;
