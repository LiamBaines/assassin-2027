-- A player's display name is chosen once, at first login, and belongs to the account, not to a game. game.player
-- .display_name stays as the name shown in that game (copied from the profile at join; an admin may rename it, e.g. to
-- tell two players with the same name apart), so names are no longer unique per game.
create table game.profile (
    auth_user_id uuid primary key,
    display_name text        not null check (char_length(display_name) between 2 and 32),
    created_at   timestamptz not null default now()
);

insert into game.profile (auth_user_id, display_name, created_at)
select distinct on (auth_user_id) auth_user_id, display_name, joined_at
  from game.player
 order by auth_user_id, joined_at, id;

drop index game.player_game_display_name_uq;

alter table game.profile enable row level security;

do $$
declare
    r text;
begin
    foreach r in array array['anon', 'authenticated'] loop
        if exists (select 1 from pg_roles where rolname = r) then
            execute format('revoke all on game.profile from %I', r);
        end if;
    end loop;
end
$$;
