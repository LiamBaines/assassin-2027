-- Admin messages: a read-only thread per player, written by the system (e.g. bonus points). Not tied to an assignment.
alter table game.message alter column assignment_id drop not null;
alter table game.message alter column sender_id drop not null;
alter table game.message add column kind text not null default 'PLAYER';
alter table game.message add column recipient_id uuid;
alter table game.message add constraint message_recipient_fk
    foreign key (recipient_id, game_id) references game.player (id, game_id);
alter table game.message add constraint message_kind_ck check (
    (kind = 'PLAYER' and assignment_id is not null and sender_id is not null and recipient_id is null)
    or (kind = 'ADMIN' and recipient_id is not null and assignment_id is null and sender_id is null));
create index message_recipient_idx on game.message (recipient_id, id) where recipient_id is not null;
