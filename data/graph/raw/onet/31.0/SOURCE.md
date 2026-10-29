# O*NET database 31.0 (text format)

- Source: US Department of Labor, Employment and Training Administration, O*NET Resource Center.
- URL: https://www.onetcenter.org/dl_files/database/db_31_0_text.zip
- Version: O*NET 31.0 Database, released 2026-08 (August 2026 Release, per the zip's Read Me.txt).
- Database page: https://www.onetcenter.org/database.html
- Retrieved: 2026-10-29. The zip has SHA-256 6883548adf5fde64cf6f801b35d15519c9225f2732c3cab0e281c652d16b23a9.
- Licence: Creative Commons Attribution 4.0 International (https://www.onetcenter.org/license_db.html). The attribution text is in README.md and the app footer.
- Pinned by `ONET_VERSION` in `data/graph/fetch_onet.py`. The zip stays in `zip/` (git-ignored).

## What was kept

Only the files the graph reads (SPEC 5.1). Total 30.9 MB, under the 40 MB limit, so the files are committed **unfiltered**: every column and every row is as O*NET published it.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| Occupation Data.txt | 265794 | 63e6029d3d30ff5c7cf39b5304a733b77a409e01c65ae7095fe92f6d18d74a66 |
| Knowledge.txt | 5710599 | 8a1ae01ed9c54de80a9049a635b43668c7f8b67cf7dbd2b349d795e6c6a7d624 |
| Work Activities.txt | 8921964 | 7e308154c3d138b19f4b74956c6f5f20037abc2d441355ae13e1f6070a12ff7f |
| Task Statements.txt | 2772538 | aee1788c7ce2ebf19c1700bc4a1d7aa69a59965736d56a521945256df3f68d08 |
| Related Occupations.txt | 716310 | af539f6f01a36e9514a0dd13cbe125df8cca1114c690505342837f338621906c |
| Job Zones.txt | 27874 | 1112ff4c077817fe650b28c65bfe30cc1436b92f96e7922fc903f05da83bc216 |
| Essential Skills.txt | 1567178 | 91ef60f7e43231136d08e8234f1624883a0ee7b951510d11851c693a2f8edea9 |
| Transferable Skills.txt | 4178878 | 7bb190ea7e58192ebd024a6775684b1d3b0216f45194669f0bf5854b2fac6596 |
| Software Skills.txt | 2496686 | 3fd63fb00251af89bf55eb1d24986e654ff61d0e5214fc238fbb56da7b4c4f4c |
| Job Titles.txt | 2397744 | 95e4b2ca0be4b37d0dcf79588c5c039500cd6ffbf1b0bb5e85b02cdb53c8b1b8 |
| Career Interest Types.txt | 629058 | 6d9a78bc145c7813e1f59a4fc9e30008f806d416673f9bea132b204c7c79939a |
| Read Me.txt | 512 | e28694f2abd45b983b13e8155e2c4fab784bd6bab4e013ad53627d22746abb2e |
| Tasks to DWAs.txt | 1150747 | 8667a918008973103390072da720a09db02812faf93610df659f653750e2769d |
| Essential Skills to Work Activities.txt | 8416 | 2e7971cc98af2cb53927359255b5116c8f95bf6c36158e5d59a6390f048d9f9d |
| Transferable Skills to Work Activities.txt | 9981 | 899412fddce5899cde948d394e43cab5ac14c69f83faad35135609a1a184b136 |

## Differences from the file names in SPEC 5.1

O*NET 31.0 renamed some files. The content model is the same.

- `Skills.txt` is now two files: `Essential Skills.txt` (element ids `2.A.*`) and `Transferable Skills.txt` (`2.B.*`). Both use the importance (IM) and level (LV) scales. The graph reads both.
- `Technology Skills.txt` is now `Software Skills.txt` (columns: O*NET-SOC Code, Workplace Example, Element ID, Element Name, Hot Technology, In Demand). The old commodity code is gone; `Element Name` is the product category and `Workplace Example` is the product name.
- `Alternate Titles.txt` is now `Job Titles.txt` (Job Title, Short Title, Source(s)).
- `Interests.txt` is now `Career Interest Types.txt`. The graph does not use it yet; it is kept because SPEC 5.1 lists it.

- Three files are **added to the SPEC 5.1 list**: `Tasks to DWAs.txt`, `Essential Skills to Work Activities.txt` and `Transferable Skills to Work Activities.txt`. SPEC 5.5 asks for the share of a skill's tasks that have AI use, and these files are the only link from tasks to skills (task, to detailed work activity, to general work activity, to skill). Together they are 1.2 MB.

## Data age

The `Date` column (MM/YYYY) on each rating row is when O*NET collected that rating. The graph stores it as the edge date. The release date above is when the file was published, which is a different thing.

## Not fetched this round

SOC to ISCO and NCO to ISCO crosswalks (T1.2): see `../../crosswalk/README.md`.
