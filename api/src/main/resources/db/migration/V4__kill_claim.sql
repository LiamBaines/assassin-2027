-- Self-reported kills. A claim is filed by the killer against their ACTIVE assignment and resolved by the victim or an admin.
create table game.kill_claim (
    id            bigint generated always as identity primary key,
    game_id       uuid        not null references game.game (id),
    assignment_id bigint      not null references game.assignment (id),
    killer_id     uuid        not null,
    victim_id     uuid        not null,
    status        text        not null,
    created_at    timestamptz not null default now(),
    resolved_at   timestamptz,
    resolved_by   text,
    kill_id       bigint references game.kill (id),
    constraint kill_claim_killer_fk foreign key (killer_id, game_id) references game.player (id, game_id),
    constraint kill_claim_victim_fk foreign key (victim_id, game_id) references game.player (id, game_id),
    constraint kill_claim_not_self_ck check (killer_id <> victim_id),
    constraint kill_claim_status_ck check (status in ('PENDING', 'CONTESTED', 'CONFIRMED', 'DISMISSED', 'WITHDRAWN', 'VOIDED'))
);

-- One open claim per victim.
create unique index kill_claim_open_victim_uq on game.kill_claim (victim_id) where status in ('PENDING', 'CONTESTED');
create index kill_claim_game_idx on game.kill_claim (game_id);
create index kill_claim_assignment_idx on game.kill_claim (assignment_id);

alter table game.kill_claim enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.kill_claim from %I', r);
        end if;
    end loop;
end
$$;
