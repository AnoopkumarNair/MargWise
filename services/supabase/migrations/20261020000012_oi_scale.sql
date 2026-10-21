-- O*NET career interest ratings are stored on the published 0–100 scale
-- (O*NET OnLine "Occupational Interest"; database OI 0–6 × 100/6 in release
-- 31.0). The original columns assumed the older 1–7 scale. career_onet_map
-- holds no rows in any environment when this runs.
--
-- Reversible: yes. Down: restore numeric(3,2) columns with between 1 and 7 checks.

do $$
declare c text;
begin
  foreach c in array array['oi_r', 'oi_i', 'oi_a', 'oi_s', 'oi_e', 'oi_c'] loop
    execute format('alter table content.career_onet_map drop constraint if exists %I', 'career_onet_map_' || c || '_check');
    execute format('alter table content.career_onet_map alter column %I type numeric(5, 2)', c);
    execute format('alter table content.career_onet_map add constraint %I check (%I between 0 and 100)', 'career_onet_map_' || c || '_range', c);
  end loop;
end $$;
