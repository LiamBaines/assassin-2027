-- Recording a kill or filing a claim now supplies a method.
alter table game.kill alter column kill_method_id set not null;
alter table game.kill_claim alter column kill_method_id set not null;
