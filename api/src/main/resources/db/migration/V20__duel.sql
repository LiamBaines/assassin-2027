-- Duels: an assassin challenges their target in the inbox thread. A duel belongs to an assignment and is resolved by
-- the players (or the admin), which records a kill for the winner.
create table game.duel (
    id                 bigint generated always as identity primary key,
    game_id            text        not null references game.game (id),
    assignment_id      bigint      not null references game.assignment (id),
    challenger_id      uuid        not null,
    challenged_id      uuid        not null,
    kill_method_id     bigint      not null references game.kill_method (id),
    activity           text        not null,
    status             text        not null,
    reported_winner_id uuid,
    reported_by_id     uuid,
    created_at         timestamptz not null default now(),
    accepted_at        timestamptz,
    resolved_at        timestamptz,
    resolved_by        text,
    kill_id            bigint references game.kill (id),
    constraint duel_challenger_fk foreign key (challenger_id, game_id) references game.player (id, game_id),
    constraint duel_challenged_fk foreign key (challenged_id, game_id) references game.player (id, game_id),
    constraint duel_reported_winner_fk foreign key (reported_winner_id, game_id) references game.player (id, game_id),
    constraint duel_reported_by_fk foreign key (reported_by_id, game_id) references game.player (id, game_id),
    constraint duel_not_self_ck check (challenger_id <> challenged_id),
    constraint duel_activity_ck check (activity = btrim(activity) and char_length(activity) between 1 and 80),
    constraint duel_status_ck check (status in ('PENDING', 'ACCEPTED', 'REPORTED', 'CONTESTED', 'COMPLETED', 'DECLINED',
                                                'REVOKED', 'VOIDED'))
);

-- One open duel per challenger.
create unique index duel_open_challenger_uq on game.duel (challenger_id)
    where status in ('PENDING', 'ACCEPTED', 'REPORTED', 'CONTESTED');
create index duel_game_idx on game.duel (game_id);
create index duel_assignment_idx on game.duel (assignment_id);

alter table game.duel enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.duel from %I', r);
        end if;
    end loop;
end
$$;

-- DUEL messages are the challenge card in a thread (sent by the challenger, body is the activity); SYSTEM messages are
-- notices to the assignment's assassin with no sender.
alter table game.message add column duel_id bigint references game.duel (id);
alter table game.message drop constraint message_kind_ck;
alter table game.message add constraint message_kind_ck check (
    (kind = 'PLAYER' and assignment_id is not null and sender_id is not null and recipient_id is null and duel_id is null)
    or (kind = 'ADMIN' and recipient_id is not null and assignment_id is null and sender_id is null and duel_id is null)
    or (kind = 'DUEL' and assignment_id is not null and sender_id is not null and recipient_id is null and duel_id is not null)
    or (kind = 'SYSTEM' and assignment_id is not null and sender_id is null and recipient_id is null and duel_id is null));
