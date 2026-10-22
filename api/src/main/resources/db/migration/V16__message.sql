-- Anonymous messages between an assassin and their target. A thread is the assignment: when the assignment ends the
-- messages stay here for admins but are no longer shown to players. Deletes are soft (deleted_at).
create table game.message (
    id            bigint generated always as identity primary key,
    game_id       text        not null references game.game (id),
    assignment_id bigint      not null references game.assignment (id),
    sender_id     uuid        not null,
    body          text        not null,
    created_at    timestamptz not null default now(),
    read_at       timestamptz,
    deleted_at    timestamptz,
    constraint message_sender_fk foreign key (sender_id, game_id) references game.player (id, game_id),
    constraint message_body_ck check (body = btrim(body) and char_length(body) between 1 and 280)
);

create index message_assignment_idx on game.message (assignment_id, id);
create index message_game_idx on game.message (game_id, id);

alter table game.message enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.message from %I', r);
        end if;
    end loop;
end
$$;
