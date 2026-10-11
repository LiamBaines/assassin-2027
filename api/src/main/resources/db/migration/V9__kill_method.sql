-- Kill methods: per game, with a points value. Never deleted, only disabled, so old kills keep their method.
create table game.kill_method (
    id         bigint generated always as identity primary key,
    game_id    uuid        not null references game.game (id),
    name       text        not null,
    points     integer     not null,
    enabled    boolean     not null default true,
    created_at timestamptz not null default now(),
    constraint kill_method_id_game_uq unique (id, game_id),
    constraint kill_method_points_ck check (points >= 0)
);

create unique index kill_method_game_name_uq on game.kill_method (game_id, lower(name));

alter table game.kill_method enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.kill_method from %I', r);
        end if;
    end loop;
end
$$;

-- Standard set for every existing game. Keep in step with KillMethodDefaults.
insert into game.kill_method (game_id, name, points)
select g.id, d.name, d.points
from game.game g
cross join (values ('Clamp', 10), ('Ticker Bomb', 10), ('Poison', 10), ('Electric Chair', 10), ('Goodbye Note', 10),
                   ('Duel', 15), ('Death Sentence', 10), ('ADoS Injection', 10), ('Remote Shutdown', 10),
                   ('Hand Grenade', 10)) as d (name, points);

-- Existing kills and claims are dev data: give each a random method from its game. Ledger rows are not rewritten.
-- The columns stay nullable until recording a kill supplies a method (V10).
alter table game.kill add column kill_method_id bigint;
alter table game.kill_claim add column kill_method_id bigint;

update game.kill k
set kill_method_id = (select m.id from game.kill_method m where m.game_id = k.game_id order by random() limit 1);
update game.kill_claim c
set kill_method_id = (select m.id from game.kill_method m where m.game_id = c.game_id order by random() limit 1);

alter table game.kill
    add constraint kill_kill_method_fk foreign key (kill_method_id, game_id) references game.kill_method (id, game_id);
alter table game.kill_claim
    add constraint kill_claim_kill_method_fk foreign key (kill_method_id, game_id) references game.kill_method (id, game_id);
