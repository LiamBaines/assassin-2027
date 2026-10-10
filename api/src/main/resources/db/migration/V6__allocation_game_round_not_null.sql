-- RingService now creates a round before the first allocation, so every allocation belongs to one.
alter table game.allocation alter column game_round_id set not null;
