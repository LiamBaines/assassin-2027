-- Rounds. The old assignment_round (a ring allocation) becomes allocation; a new game_round groups allocations.
alter table game.assignment_round rename to allocation;
alter table game.allocation rename column round_no to allocation_no;
alter table game.allocation rename constraint assignment_round_game_round_no_uq to allocation_game_allocation_no_uq;
alter table game.allocation rename constraint assignment_round_id_game_uq to allocation_id_game_uq;

alter table game.assignment rename column round_id to allocation_id;
alter table game.assignment rename constraint assignment_round_fk to assignment_allocation_fk;
alter index game.assignment_round_idx rename to assignment_allocation_idx;

create table game.game_round (
    id         uuid primary key default gen_random_uuid(),
    game_id    uuid        not null references game.game (id),
    round_no   integer     not null check (round_no > 0),
    started_at timestamptz not null default now(),
    ended_at   timestamptz,
    winner_id  uuid,
    created_by text        not null,
    constraint game_round_game_round_no_uq unique (game_id, round_no),
    constraint game_round_id_game_uq unique (id, game_id),
    constraint game_round_winner_fk foreign key (winner_id, game_id) references game.player (id, game_id),
    constraint game_round_winner_ended_ck check (winner_id is null or ended_at is not null)
);

-- At most one open round per game.
create unique index game_round_open_uq on game.game_round (game_id) where ended_at is null;

alter table game.allocation add column game_round_id uuid;

-- Existing games with allocations get an open round 1 that owns them all.
insert into game.game_round (game_id, round_no, started_at, created_by)
select game_id, 1, min(created_at), (array_agg(created_by order by allocation_no))[1]
  from game.allocation
 group by game_id;

update game.allocation a
   set game_round_id = r.id
  from game.game_round r
 where r.game_id = a.game_id;

-- game_round_id becomes NOT NULL once RingService creates rounds (rounds task 2).
alter table game.allocation
    add constraint allocation_game_round_fk foreign key (game_round_id, game_id) references game.game_round (id, game_id);
create index allocation_game_round_idx on game.allocation (game_round_id);

alter table game.game_round enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.game_round from %I', r);
        end if;
    end loop;
end
$$;
