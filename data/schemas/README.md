# Data contracts

`pipeline/validate.py` enforces these contracts on every build. A build with an error is never published.

content.json
- fields[]: id, name, group, stream, blurb, areas[], pick, subjects{cbse,isc,state}, exams, degree, early, verify[], sources[{id,name,url}], backup, compare
- careers[]: id, title, field (must exist), soc (NN-NNNN.NN), values{R,I,A,S,E,C: 0-100}, line, us{annual|hourly, growth, openings, wageYear}, in{group, monthly}, ai{obs 0-1 or null, theo 0-1 or null, tier, used[], human[], nTasks}
- plfs, aiMeta, fieldRef (reference percentiles per field), fieldK, checked, status

abroad.json
- countries[8]: id, name, cur, sym, ug|pg|living{lo<=hi, conf, note, src}, scholarships[], tests, after{t, conf, src}, settle, salary, notes[]
- asOf, nextReview, fx{date, source, rates}, routes[], legend{}, disclaimer

story2.json
- scenes{sNN: place, setup, keeper, line, lit, o{trait: card text}}
