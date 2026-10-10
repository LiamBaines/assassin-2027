-- A revived player can die again in a later round, so "dies once" becomes "dies once per round".
alter table game.kill add column game_round_id uuid;
update game.kill k
   set game_round_id = al.game_round_id
  from game.assignment a
  join game.allocation al on al.id = a.allocation_id
 where a.id = k.assignment_id;
alter table game.kill alter column game_round_id set not null;
alter table game.kill
    add constraint kill_game_round_fk foreign key (game_round_id, game_id) references game.game_round (id, game_id);
alter table game.kill drop constraint kill_victim_uq;
alter table game.kill add constraint kill_victim_round_uq unique (victim_id, game_round_id);
