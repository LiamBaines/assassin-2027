-- A game's id becomes its URL slug (text) instead of a UUID. Existing rows are test data and
-- are discarded rather than backfilled.
truncate table game.game cascade;

-- Foreign keys involving game_id (or game.game itself) can't survive the type change, so
-- capture their definitions, drop them, retype the columns, then recreate them.
create temp table fk_defs on commit drop as
select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
from pg_constraint c
where c.contype = 'f'
  and c.connamespace = 'game'::regnamespace
  and (c.confrelid = 'game.game'::regclass
       or exists (select 1
                  from pg_attribute a
                  where a.attrelid = c.conrelid
                    and a.attnum = any (c.conkey)
                    and a.attname = 'game_id')
       or exists (select 1
                  from pg_attribute a
                  where a.attrelid = c.confrelid
                    and a.attnum = any (c.confkey)
                    and a.attname = 'game_id'));

do $$
declare
    r record;
begin
    for r in select * from fk_defs loop
        execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    end loop;

    alter table game.game alter column id drop default;
    alter table game.game alter column id type text using id::text;
    alter table game.game
        add constraint game_id_slug_ck check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) <= 60);

    for r in
        select table_name
        from information_schema.columns
        where table_schema = 'game' and column_name = 'game_id'
    loop
        execute format('alter table game.%I alter column game_id type text using game_id::text', r.table_name);
    end loop;

    for r in select * from fk_defs loop
        execute format('alter table %s add constraint %I %s', r.tbl, r.conname, r.def);
    end loop;
end
$$;
