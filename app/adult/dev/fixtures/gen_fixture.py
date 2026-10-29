# Regenerates app/adult/dev/fixtures/graph/ (TEST FIXTURE, made-up values). Run: python3 app/adult/dev/fixtures/gen_fixture.py
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'graph')
def need(i, label, w, kind='skill', ai='mixed'):
    return {"id": i, "label": label, "kind": kind, "w": w, "ai": ai, "as_of": "2023-06", "src": "fixture"}
SK = [  # shared fixture skill pool: id, label, kind
 ("skl:2.A.1.a","Reading Comprehension","skill"),("skl:2.A.1.b","Active Listening","skill"),("skl:2.A.1.c","Writing","skill"),
 ("skl:2.A.1.d","Speaking","skill"),("skl:2.A.1.e","Mathematics","skill"),("skl:2.A.2.a","Critical Thinking","skill"),
 ("skl:2.A.2.b","Active Learning","skill"),("skl:2.B.1.a","Social Perceptiveness","skill"),("skl:2.B.1.b","Coordination","skill"),
 ("skl:2.B.1.c","Persuasion","skill"),("skl:2.B.1.d","Negotiation","skill"),("skl:2.B.4.e","Judgment and Decision Making","skill"),
 ("skl:2.B.5.a","Systems Analysis","skill"),("skl:2.B.5.b","Systems Evaluation","skill"),("skl:2.A.2.d","Monitoring","skill"),
 ("skl:2.C.1.a","Economics and Accounting","knowledge"),("skl:2.C.1.b","Administration and Management","knowledge"),
 ("skl:2.C.1.c","Customer and Personal Service","knowledge"),("skl:2.C.3.a","Computers and Electronics","knowledge"),
 ("skl:2.C.4.a","Mathematics knowledge","knowledge"),("skl:2.C.7.a","English Language","knowledge"),("skl:2.C.1.e","Law and Government","knowledge"),
 ("tec:excel","Microsoft Excel","technology"),("tec:tally","Tally accounting software","technology"),("tec:sap","SAP enterprise software","technology"),
 ("tec:sql","SQL database queries","technology"),("tec:python","Python","technology"),("tec:powerbi","Microsoft Power BI","technology"),
 ("tec:tableau","Tableau","technology"),("tec:js","JavaScript","technology"),("tec:git","Git version control","technology"),
 ("tec:jira","Jira issue tracking","technology"),
]
SKD = {s[0]: s for s in SK}
def mk(ids_w, ai_map=None):
    out = []
    for i, w in ids_w:
        s = SKD[i]; ai = (ai_map or {}).get(i, 'mixed')
        out.append(need(i, s[1], w, s[2], ai))
    return out
def weights(ids, start=0.9, step=0.021):
    return [(i, round(start - k*step, 2)) for k, i in enumerate(ids)]
A = ["tec:excel","skl:2.C.1.a","skl:2.A.2.a","skl:2.A.1.e","skl:2.C.4.a","tec:tally","skl:2.A.1.a","skl:2.B.4.e","skl:2.A.1.c","skl:2.C.7.a","skl:2.A.1.b","skl:2.A.2.d","tec:sap","skl:2.C.1.b","skl:2.A.1.d","skl:2.C.3.a","skl:2.B.5.a","skl:2.C.1.e","skl:2.A.2.b","skl:2.B.1.b","skl:2.B.1.d","skl:2.C.1.c","skl:2.B.5.b","skl:2.B.1.a","skl:2.B.1.c","tec:sql","tec:powerbi","tec:jira"]
F = ["skl:2.C.1.a","tec:excel","skl:2.A.2.a","skl:2.A.1.e","skl:2.C.4.a","skl:2.B.5.a","skl:2.B.4.e","tec:sql","tec:powerbi","skl:2.A.1.a","skl:2.A.1.c","skl:2.B.5.b","tec:python","skl:2.C.3.a","skl:2.A.2.d","skl:2.A.1.d","skl:2.C.7.a","skl:2.B.1.c"]
D = ["tec:sql","tec:python","skl:2.A.2.a","skl:2.A.1.e","skl:2.C.4.a","tec:excel","tec:powerbi","tec:tableau","skl:2.B.5.a","skl:2.A.1.c","skl:2.C.3.a","skl:2.A.1.a","skl:2.B.4.e","skl:2.B.5.b","skl:2.A.2.b"]
P = ["skl:2.C.1.b","skl:2.B.1.b","tec:jira","skl:2.A.1.d","skl:2.A.1.c","skl:2.B.4.e","skl:2.A.2.a","skl:2.B.1.d","skl:2.B.5.a","skl:2.A.1.b","skl:2.C.1.c","skl:2.A.2.d","tec:excel","skl:2.B.1.c"]
SW = ["tec:js","tec:git","tec:sql","tec:python","skl:2.C.3.a","skl:2.B.5.a","skl:2.A.2.a","skl:2.A.1.e","skl:2.A.2.b","skl:2.B.5.b","tec:jira","skl:2.A.1.c","skl:2.A.1.a","skl:2.B.4.e"]
AIM = {"tec:excel":"mixed","skl:2.C.1.a":"ai_does_much","skl:2.C.4.a":"ai_does_much","skl:2.B.1.d":"people_do","skl:2.B.1.c":"people_do","skl:2.A.1.b":"people_do","skl:2.B.1.a":"people_do"}
def occ(i, label, zone, alt=None, soc=None):
    o = {"id": i, "label": label, "job_zone": zone, "as_of": "2025-08", "src": "fixture"}
    if alt: o["alt"] = alt
    if soc: o["soc"] = soc
    return o
sources = [{"id":"fixture","name":"FIXTURE DATA (hand-written for tests, not real O*NET values)","trust":"estimate","as_of":"2025-08"},
           {"id":"fixture_ai","name":"FIXTURE AI use (hand-written for tests)","trust":"estimate","as_of":"2026-03"}]
def sig(kind, value, per="2026Q1"): return {"kind": kind, "period": per, "value": value, "as_of": "2026-03", "src": "fixture_ai" if kind.startswith("ai") else "fixture"}
def target(o, ids, via, sigs): return {"occ": o, "via": via, "needs": mk(weights(ids), AIM), "signals": sigs}
acc = occ("occ:13-2011.00","Accountants and Auditors",4,["Chartered Accountant","CA","Tax Accountant","Staff Accountant","Auditor"],"13-2011")
fin = occ("occ:13-2051.00","Financial and Investment Analysts",4,["Financial Analyst","Equity Research Analyst"],"13-2051")
dat = occ("occ:15-2051.00","Data Scientists",5,["Data Analyst","Analytics Associate"],"15-2051")
pm = occ("occ:11-3021.00","Computer and Information Systems Managers",5,["IT Project Manager","Delivery Manager"],"11-3021")
swd = occ("occ:15-1252.00","Software Developers",4,["Software Engineer","Programmer","Full Stack Developer","Backend Developer"],"15-1252")
bia = occ("occ:15-2051.01","Business Intelligence Analysts",4,["BI Analyst","MIS Executive"],"15-2051")
mgr = occ("occ:11-3031.00","Financial Managers",5,["Finance Manager","Controller"],"11-3031")
leap = occ("occ:ai-llm-evaluator","LLM Evaluation Specialist",4,["AI Quality Reviewer"])
leap["new_role"] = True; leap["maturity"] = "settling"
def slice_(o, ids, targets, sigs, tasks):
    return {"slice_v":1,"release":"fixture","occ":o,"needs":mk(weights(ids), AIM),"tasks":tasks,"signals":sigs,"targets":targets,"sources":sources}
tasks_acc = [{"id":"tsk:f1","label":"Prepare financial statements and reports.","ai_mode":"augmentation","as_of":"2026-03","src":"fixture_ai"},
             {"id":"tsk:f2","label":"Talk with clients about their accounts.","ai_mode":"none","as_of":"2026-03","src":"fixture_ai"}]
s_acc = slice_(acc, A, [
  target(fin, F, ["close_to"], [sig("ai_obs",0.38),sig("pay_band_in","PLFS broad group: professional, mid band")]),
  target(bia, D, ["two_step"], [sig("ai_obs",0.51)]),
  target(mgr, F, ["same_cluster"], [sig("ai_obs",0.22)]),
  target(dat, D, ["two_step"], [sig("ai_obs",0.61)]),
  target(pm, P, ["two_step"], []),
  target(leap, ["tec:python","tec:js","tec:git","tec:tableau","tec:sql","tec:powerbi","tec:jira","skl:2.A.1.c","skl:2.A.2.a","skl:2.B.5.a"], ["two_step"], [sig("ai_obs",0.9)]),
 ], [sig("ai_obs",0.42),sig("pay_band_in","PLFS broad group: professional, mid band")], tasks_acc)
s_sw = slice_(swd, SW, [
  target(dat, D, ["close_to"], [sig("ai_obs",0.61)]),
  target(pm, P, ["same_cluster"], []),
  target(bia, D, ["two_step"], [sig("ai_obs",0.51)]),
 ], [sig("ai_obs",0.7)], [{"id":"tsk:f3","label":"Write and test code.","ai_mode":"automation","as_of":"2026-03","src":"fixture_ai"}])
os.makedirs(OUT+'/slices', exist_ok=True)
json.dump(s_acc, open(OUT+'/slices/13-2011.00.json','w'), indent=1)
json.dump(s_sw, open(OUT+'/slices/15-1252.00.json','w'), indent=1)
idx = [{"id":i,"label":l,"alt":[],"kind":k} for i,l,k in SK]
json.dump(idx, open(OUT+'/skills_index.json','w'), indent=1)
titles = {"accountant":["occ:13-2011.00"],"chartered accountant":["occ:13-2011.00"],"auditor":["occ:13-2011.00"],"tax accountant":["occ:13-2011.00"],
 "staff accountant":["occ:13-2011.00"],"software engineer":["occ:15-1252.00"],"software developer":["occ:15-1252.00"],"programmer":["occ:15-1252.00"],
 "full stack developer":["occ:15-1252.00"],"financial analyst":["occ:13-2051.00"],"data analyst":["occ:15-2051.00","occ:15-2051.01"],"mis executive":["occ:15-2051.01"]}
json.dump(titles, open(OUT+'/titles.json','w'), indent=1)
open(OUT+'/README.md','w').write("# FIXTURE graph (tests only)\n\nHand-written by the frontend lane so the adult app can be built and tested before the data lane delivers `data/graph/`. The values are made up. `app/adult/build.py` uses this folder only with `--dev`, and only when `data/graph/slices/` does not exist. It is never used in a release build.\n")
