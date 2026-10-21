-- Kill words for the Death Sentence method: a per-game list. A word is UNUSED until allocated to an assassin for a
-- round, then ALLOCATED, then USED once it killed. Rows are never reused or deleted once allocated, so the word stays
-- burned for the whole game. Random words are inserted at allocation time.
create table game.kill_word (
    id         bigint generated always as identity primary key,
    game_id    text        not null references game.game (id),
    text       text        not null,
    state      text        not null default 'UNUSED',
    origin     text        not null,
    player_id  uuid,
    round_no   integer,
    used_at    timestamptz,
    created_at timestamptz not null default now(),
    constraint kill_word_state_ck check (state in ('UNUSED', 'ALLOCATED', 'USED')),
    constraint kill_word_origin_ck check (origin in ('ADMIN', 'RANDOM')),
    constraint kill_word_text_ck check (text = btrim(text) and char_length(text) between 1 and 60),
    constraint kill_word_allocation_ck check (
        (state = 'UNUSED' and player_id is null and round_no is null and used_at is null)
        or (state = 'ALLOCATED' and player_id is not null and round_no is not null and used_at is null)
        or (state = 'USED' and player_id is not null and round_no is not null and used_at is not null)),
    constraint kill_word_player_fk foreign key (player_id, game_id) references game.player (id, game_id),
    constraint kill_word_round_fk foreign key (game_id, round_no) references game.game_round (game_id, round_no)
);

create unique index kill_word_game_text_uq on game.kill_word (game_id, lower(text));
-- One live word per assassin per round.
create unique index kill_word_player_round_uq on game.kill_word (game_id, player_id, round_no) where player_id is not null;

alter table game.kill_word enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.kill_word from %I', r);
        end if;
    end loop;
end
$$;
