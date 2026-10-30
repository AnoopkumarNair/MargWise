# Hand-written inputs to the graph (all need the owner's review)

| File | What it is | Status |
| --- | --- | --- |
| `abbrev_in.csv` | Indian job abbreviations and short names for tools and skills (IT, BPM, BFSI). `term,maps_to_id,note`. A `skl:` or `tec:` id becomes an alternative name in `skills_index.json`; an `occ:` id becomes an entry in `titles.json`. A note with the word "ambiguous" marks the term as needing a nearby context word. | **Drafted by the data lane. Not reviewed.** Every mapping is a judgement. |
| `titles_in.csv` | Indian job titles that O*NET does not list. `levels=Y` also adds the seniority forms (associate, senior associate, senior, lead, AM, DM, manager, AVP, VP). Bare level words map to a short pick list. | **Drafted by the data lane. Not reviewed.** |
| `soc_aliases.csv` | An O*NET code in `data/content.json` that no longer exists in O*NET 31.0, with the code that replaced it. | One row. `content.json` is not changed here. |
| `crosswalk/` | SOC to ISCO and NCO to ISCO (T1.2). | Blocked: see `crosswalk/README.md`. |

Terms from BUILD_PLAN T1.5 that have no id in the graph yet (so they are not in `abbrev_in.csv`): see `abbrev_in_unmapped.csv`. They need S2 work (emerging skills, domain terms) before they can point at a node.
