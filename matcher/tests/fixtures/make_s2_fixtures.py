#!/usr/bin/env python3
"""Writes the hand-built S2 matcher fixtures (matcher 1.2.0). Not real data: weights, AI labels, pay, city shares, costs and hours
are made up to exercise the rules of SPEC 7.2 to 7.4. Occupation ids, labels and job zones follow O*NET so the road kinds read
naturally; nothing else here is a fact about those jobs.

Run: python3 matcher/tests/fixtures/make_s2_fixtures.py   (rewrites the four files below; the golden lock then shows any change)

  slice_qa_analyst.json   QA analyst: a new AI-era role (LLM evaluation, levels from typical_level), up, across, diagonal, fork
  slice_bpm_lead.json     BPM team lead: a reset into a new role (AI trainer), resets, a management fork, a step down
  slice_bfsi_sales.json   Financial services sales agent: numeric pay_band_in on every occupation (pay change, below_pay_floor),
                          and the PROVISIONAL city_share / remote_share encoding (needs_relocation)
  credentials.json        a made-up reviewed credential catalogue for bridges (SPEC 5.8 fields; 'label' is the catalogue's name)
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
AS_OF = '2026-10'
SOURCES = [{'id': 'fixture', 'name': 'Hand-built matcher test fixture (S2). Not real data: weights, labels, AI shares, pay and city shares are made up for tests.',
            'trust': 'estimate', 'as_of': AS_OF}]


def need(i, label, kind, w, ai):
    return {'id': i, 'label': label, 'kind': kind, 'w': w, 'ai': ai, 'as_of': AS_OF, 'src': 'fixture'}


def sig(kind, value, period='2026Q1'):
    return {'kind': kind, 'period': period, 'value': value, 'as_of': AS_OF, 'src': 'fixture'}


def occ(i, label, zone, **extra):
    o = {'id': i, 'label': label, 'job_zone': zone, 'as_of': AS_OF, 'src': 'fixture'}
    o.update(extra)
    return o


def target(o, needs, signals, via=('close_to',)):
    return {'occ': o, 'via': list(via), 'needs': needs, 'signals': signals}


def slice_(o, needs, signals, targets):
    return {'slice_v': 1, 'release': 'fixture-s2', 'occ': o, 'needs': needs, 'tasks': [], 'signals': signals, 'targets': targets,
            'sources': SOURCES}


# Shared needs
QC = ('skl:2.B.3.m', 'Quality Control Analysis', 'skill')
CRIT = ('skl:2.A.2.a', 'Critical Thinking', 'skill')
WRITE = ('skl:2.A.1.c', 'Writing', 'skill')
PROG = ('skl:2.B.3.e', 'Programming', 'skill')
PY = ('tec:python', 'Python', 'technology')
SQL = ('tec:sql', 'SQL', 'technology')
ADMIN_MGMT = ('skl:2.C.1.a', 'Administration and Management', 'knowledge')
PEOPLE = ('skl:2.B.5.d', 'Management of Personnel Resources', 'skill')
JUDGE = ('skl:2.B.4.e', 'Judgment and Decision Making', 'skill')
COORD = ('skl:2.B.1.b', 'Coordination', 'skill')
MONITOR = ('skl:2.A.2.d', 'Monitoring', 'skill')
CUST = ('skl:2.C.1.e', 'Customer and Personal Service', 'knowledge')
ADMIN = ('skl:2.C.1.b', 'Administrative', 'knowledge')
EXCEL = ('tec:excel', 'Microsoft Excel', 'technology')
SPEAK = ('skl:2.A.1.d', 'Speaking', 'skill')
PERSUADE = ('skl:2.B.1.c', 'Persuasion', 'skill')
SALESFORCE = ('tec:salesforce', 'Salesforce CRM', 'technology')
ECON = ('skl:2.C.1.c', 'Economics and Accounting', 'knowledge')
LAW = ('skl:2.C.8.b', 'Law and Government', 'knowledge')
SOCIAL = ('skl:2.B.1.a', 'Social Perceptiveness', 'skill')


def n(t, w, ai):
    return need(t[0], t[1], t[2], w, ai)


def qa_analyst():
    o = occ('occ:15-1253.00', 'Software Quality Assurance Analysts and Testers', 4, soc='15-1253')
    needs = [n(QC, 0.9, 'mixed'), need('tec:selenium', 'Selenium', 'technology', 0.6, 'ai_does_much'), n(CRIT, 0.6, 'mixed'),
             need('tec:jira', 'Atlassian JIRA', 'technology', 0.5, 'mixed'), n(PROG, 0.5, 'mixed')]
    targets = [
        target(occ('occ:ai-llm-evaluator', 'LLM Evaluation Specialist', None, new_role=True, maturity='settling', typical_level=[2, 4]),
               [need('skl:ai-llm-evaluation', 'Evaluating large language model outputs', 'skill', 0.9, 'people_do'),
                n(QC, 0.8, 'people_do'), n(WRITE, 0.6, 'mixed'), n(PY, 0.6, 'mixed'), n(CRIT, 0.6, 'people_do')],
               [], via=('entry_from',)),
        target(occ('occ:15-1252.00', 'Software Developers', 4),
               [n(PROG, 0.9, 'mixed'), need('tec:java', 'Java', 'technology', 0.7, 'mixed'), need('tec:git', 'Git', 'technology', 0.6, 'ai_does_much'),
                n(SQL, 0.6, 'mixed'), need('skl:2.B.2.i', 'Complex Problem Solving', 'skill', 0.6, 'people_do')],
               [sig('ai_obs', 0.55)]),
        target(occ('occ:11-3051.01', 'Quality Control Systems Managers', 4),
               [n(ADMIN_MGMT, 0.8, 'people_do'), n(PEOPLE, 0.7, 'people_do'), n(QC, 0.7, 'mixed'), n(JUDGE, 0.6, 'people_do')],
               [sig('ai_obs', 0.2)]),
        target(occ('occ:15-2051.00', 'Data Scientists', 5),
               [n(PY, 0.8, 'mixed'), n(PROG, 0.7, 'mixed'), n(SQL, 0.7, 'mixed'), need('skl:2.C.4.a', 'Mathematics', 'knowledge', 0.7, 'mixed'),
                n(CRIT, 0.6, 'mixed')],
               [sig('ai_obs', 0.35)], via=('two_step',)),
        target(occ('occ:15-1221.00', 'Computer and Information Research Scientists', 5),
               [n(PROG, 0.8, 'mixed'), need('skl:2.C.4.a', 'Mathematics', 'knowledge', 0.8, 'mixed'), n(CRIT, 0.7, 'mixed'),
                n(QC, 0.5, 'mixed'), n(PY, 0.5, 'mixed')],
               [sig('ai_obs', 0.3)], via=('same_cluster',)),
    ]
    return slice_(o, needs, [sig('ai_obs', 0.5)], targets)


def bpm_lead():
    o = occ('occ:43-1011.00', 'First-Line Supervisors of Office and Administrative Support Workers', 3, soc='43-1011')
    needs = [n(PEOPLE, 0.8, 'people_do'), n(COORD, 0.7, 'people_do'), n(CUST, 0.7, 'mixed'), n(MONITOR, 0.6, 'people_do'),
             n(ADMIN, 0.5, 'ai_does_much')]
    targets = [
        target(occ('occ:ai-data-trainer', 'AI Trainer (data annotation and review)', None, new_role=True, maturity='settling', typical_level=[1, 3]),
               [need('skl:ai-data-labeling', 'Labelling and reviewing data for AI models', 'skill', 0.9, 'people_do'),
                need('skl:ai-prompt-writing', 'Writing and testing prompts', 'skill', 0.7, 'mixed'),
                n(WRITE, 0.6, 'mixed'), n(MONITOR, 0.6, 'people_do'), n(EXCEL, 0.5, 'ai_does_much')],
               [], via=('entry_from',)),
        target(occ('occ:15-1232.00', 'Computer User Support Specialists', 3),
               [need('skl:2.C.3.a', 'Computers and Electronics', 'knowledge', 0.8, 'mixed'), need('tec:servicenow', 'ServiceNow', 'technology', 0.7, 'mixed'),
                n(CUST, 0.7, 'mixed'), need('skl:2.B.1.f', 'Service Orientation', 'skill', 0.6, 'mixed'),
                need('skl:2.B.2.i', 'Complex Problem Solving', 'skill', 0.5, 'people_do')],
               [sig('ai_obs', 0.5)]),
        target(occ('occ:11-3012.00', 'Administrative Services Managers', 3),
               [n(ADMIN_MGMT, 0.8, 'people_do'), n(PEOPLE, 0.7, 'people_do'), n(COORD, 0.7, 'people_do'), n(ADMIN, 0.6, 'ai_does_much'),
                n(JUDGE, 0.5, 'people_do')],
               [sig('ai_obs', 0.25)]),
        target(occ('occ:13-1151.00', 'Training and Development Specialists', 4),
               [need('skl:2.C.6', 'Education and Training', 'knowledge', 0.8, 'people_do'), need('skl:2.B.1.e', 'Instructing', 'skill', 0.8, 'people_do'),
                n(SPEAK, 0.7, 'people_do'), n(WRITE, 0.6, 'mixed'), need('skl:2.C.4.e', 'Psychology', 'knowledge', 0.4, 'people_do')],
               [sig('ai_obs', 0.33)]),
        target(occ('occ:43-4051.00', 'Customer Service Representatives', 2),
               [n(CUST, 0.9, 'mixed'), need('skl:2.B.1.f', 'Service Orientation', 'skill', 0.8, 'mixed'), need('skl:2.A.1.b', 'Active Listening', 'skill', 0.8, 'people_do'),
                n(SPEAK, 0.7, 'mixed'), n(SALESFORCE, 0.5, 'ai_does_much')],
               [sig('ai_obs', 0.6)]),
    ]
    return slice_(o, needs, [sig('ai_obs', 0.3)], targets)


def bfsi_sales():
    # pay_band_in as a number: a made-up typical monthly pay in rupees. Only the ratio between two occupations is used.
    o = occ('occ:41-3031.00', 'Securities, Commodities, and Financial Services Sales Agents', 4, soc='41-3031')
    needs = [n(PERSUADE, 0.8, 'people_do'), n(ECON, 0.7, 'ai_does_much'), n(CUST, 0.7, 'mixed'), n(SPEAK, 0.6, 'mixed'),
             n(SALESFORCE, 0.5, 'ai_does_much'), n(LAW, 0.4, 'mixed')]
    pay = lambda v: sig('pay_band_in', v, '2023-24')
    targets = [
        target(occ('occ:41-3021.00', 'Insurance Sales Agents', 4),
               [n(PERSUADE, 0.8, 'people_do'), n(CUST, 0.8, 'mixed'), n(SPEAK, 0.6, 'mixed'), n(SALESFORCE, 0.5, 'ai_does_much'), n(LAW, 0.4, 'mixed')],
               [sig('ai_obs', 0.3), pay(42000), sig('city_share', 'city:pnq=0.45,city:bom=0.25,city:ncr=0.15,city:other=0.15'), sig('remote_share', 0.1)]),
        target(occ('occ:13-2072.00', 'Loan Officers', 4),
               [n(ECON, 0.8, 'ai_does_much'), n(CUST, 0.7, 'mixed'), n(JUDGE, 0.7, 'people_do'), n(LAW, 0.6, 'mixed'), n(EXCEL, 0.5, 'mixed')],
               [sig('ai_obs', 0.4), pay(54000)]),
        target(occ('occ:43-4011.00', 'Brokerage Clerks', 3),
               [n(ADMIN, 0.8, 'ai_does_much'), n(ECON, 0.7, 'ai_does_much'), n(EXCEL, 0.6, 'ai_does_much'), n(CUST, 0.5, 'mixed')],
               [sig('ai_obs', 0.6), pay(30000)]),
        target(occ('occ:13-2052.00', 'Personal Financial Advisors', 4),
               [n(ECON, 0.8, 'mixed'), n(CUST, 0.8, 'mixed'), n(PERSUADE, 0.6, 'people_do'), n(SOCIAL, 0.6, 'people_do'), n(LAW, 0.5, 'mixed')],
               [sig('ai_obs', 0.25), pay(57000), sig('city_share', 'city:bom=0.55,city:ncr=0.25,city:blr=0.2'), sig('remote_share', 0.05)]),
        target(occ('occ:41-3091.00', 'Sales Representatives of Services', 2),
               [n(PERSUADE, 0.8, 'people_do'), n(CUST, 0.7, 'mixed'), n(SPEAK, 0.7, 'mixed'), n(SALESFORCE, 0.6, 'mixed'), n(SOCIAL, 0.5, 'people_do')],
               [sig('ai_obs', 0.36), pay(33000)]),
    ]
    return slice_(o, needs, [sig('ai_obs', 0.35), pay(60000)], targets)


def credentials():
    def cred(i, label, hours, cost, validity, teaches):
        return {'id': i, 'label': label, 'issuer': 'Test issuer (made up)', 'official_url': 'https://example.org/' + i[5:],
                'cost_inr': cost, 'hours': hours, 'validity_years': validity,
                'teaches': [{'id': t, 'quote': 'made up for tests'} for t in teaches]}
    return {
        '_doc': 'Made-up reviewed credential catalogue for matcher tests (SPEC 5.8 fields; label is the catalogue name). Not real data: the names, costs, hours, links and taught skills are invented. cred:copc teaches the same skills as in teaches.json, so a person holding it gets the same credit either way.',
        'credentials': [
            cred('cred:copc', 'COPC (test entry)', 80, 60000, 3, ['skl:2.A.2.d', 'skl:2.B.5.d', 'skl:2.B.1.b']),
            cred('cred:demo-data-labeling', 'Demo course: data labelling for AI', 40, 5000, None, ['skl:ai-data-labeling', 'skl:ai-prompt-writing']),
            cred('cred:demo-llm-eval', 'Demo course: evaluating LLM outputs', 40, 15000, 2, ['skl:ai-llm-evaluation', 'skl:2.A.1.c']),
            cred('cred:demo-people-lead', 'Demo course: leading a team', 120, 45000, 3, ['skl:2.B.5.d', 'skl:2.B.1.b', 'skl:2.C.1.a', 'skl:2.B.4.e']),
            cred('cred:demo-python', 'Demo course: Python for data work', 60, 0, None, ['tec:python', 'skl:2.B.3.e', 'tec:sql']),
            cred('cred:demo-sales', 'Demo course: consultative selling', 30, 8000, None, ['skl:2.B.1.c', 'tec:salesforce', 'skl:2.B.1.a']),
            cred('cred:demo-servicenow', 'Demo course: ServiceNow administration', 50, 20000, 2, ['tec:servicenow', 'skl:2.C.3.a']),
            cred('cred:demo-training', 'Demo course: training adults', 150, 30000, None, ['skl:2.C.6', 'skl:2.B.1.e', 'skl:2.C.4.e']),
        ],
    }


def write(name, data):
    with open(os.path.join(HERE, name), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write('\n')


if __name__ == '__main__':
    write('slice_qa_analyst.json', qa_analyst())
    write('slice_bpm_lead.json', bpm_lead())
    write('slice_bfsi_sales.json', bfsi_sales())
    write('credentials.json', credentials())
    print('wrote 4 fixtures')
