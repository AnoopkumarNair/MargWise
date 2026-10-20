-- Who was active for each event (teen / patron / family), as its own column so
-- Studio aggregates can split time and funnels by family member (D-027).
-- telemetry.events held no rows in any environment when this ran.
--
-- Reversible: yes. Down: alter table telemetry.events drop column actor;

alter table telemetry.events
  add column actor text not null check (actor in ('teen', 'patron', 'family'));
create index events_actor_type_idx on telemetry.events (actor, type);
