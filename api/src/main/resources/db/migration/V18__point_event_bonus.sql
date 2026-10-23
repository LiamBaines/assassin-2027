-- Admin bonus points: a BONUS row with a required reason, optionally linked to a kill.
alter table game.point_event drop constraint point_event_type_ck;
alter table game.point_event add constraint point_event_type_ck check (type in ('KILL', 'DEATH', 'ADJUST', 'BONUS'));

alter table game.point_event add column reason text;
alter table game.point_event add constraint point_event_reason_ck
    check (reason is null or char_length(reason) between 1 and 140);
