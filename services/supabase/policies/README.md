RLS policies are created in the migrations that create their tables
(`../migrations/`), because every database change is a migration (RULES.md
rule 10; docs/decisions.md D-006). The policy summary is in
`docs/data-model.md#row-level-security`.
