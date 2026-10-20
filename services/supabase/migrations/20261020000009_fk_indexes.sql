-- Covering indexes for the two foreign keys flagged by the Supabase
-- performance advisor on staging. A DB test now fails on any unindexed FK.
--
-- Reversible: yes. Down: drop index content.provenance_reviewer_idx, content.releases_published_by_idx;

create index provenance_reviewer_idx on content.provenance (reviewer);
create index releases_published_by_idx on content.releases (published_by);
