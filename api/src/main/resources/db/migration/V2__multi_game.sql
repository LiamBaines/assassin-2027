-- Several games may be live at once. A join code must be unique among games that are not
-- FINISHED, and is free for reuse once its game finishes.
drop index game.game_one_live_uq;

create unique index game_join_code_live_uq on game.game (join_code) where status <> 'FINISHED';
