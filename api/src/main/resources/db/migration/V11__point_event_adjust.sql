-- Correcting a kill's method writes an offsetting ADJUST row for the killer; a kill can be corrected repeatedly.
alter table game.point_event drop constraint point_event_type_ck;
alter table game.point_event add constraint point_event_type_ck check (type in ('KILL', 'DEATH', 'ADJUST'));

drop index game.point_event_kill_player_uq;
create unique index point_event_kill_player_uq on game.point_event (kill_id, player_id)
    where kill_id is not null and type in ('KILL', 'DEATH');
