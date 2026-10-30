// The data inventory (BACKEND ADR-11, ADR-14): every table and every stored field, with its purpose, retention, who can see it and how it is deleted.
// Deletion (me/delete, the purge), the "See what you keep" export, the privacy notice and the invariant checker all read this one list.
// Tests fail if a table or column exists in the database and is missing here (or the reverse), and if a table holding tester_id or email_hash is missing.
//
// status: 'live'    the table/column exists in the migrations today.
//         'planned' it is designed (SPEC section 10) but its migration has not landed yet (0001_adult.sql, tickets T3.1). Flip it to 'live' in the same change as the migration.
// erase.key: the column that ties a row to a person, so deletion can find it.
//         'id' (testers itself), 'tester_id', 'email_hash'; null = the row is not about a person (counters, settings, content) and is not deleted per person.
// who: tester = the person themselves; owner = the admin page; counsellor = only their own students (never adults, ADR-15); nobody = stored but never shown (a hash used for look-ups).
const D = 'Deleted with the tester (me/delete and the purge).';

const table = (name, status, t, fields) => ({ table: name, status, ...t, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? { purpose: v } : v])) });
const P = { personal: true };

export const INVENTORY = [
  table('testers', 'live', { purpose: 'One row per person who joined.', retention: 'Until the retention period ends (RETENTION_DAYS_STUDENT / _ADULT), or until the person deletes it.', who: ['tester', 'owner', 'counsellor'], deletion: D, erase: { key: 'id' } }, {
    id: 'Random id that stands for the person.',
    name: { purpose: 'First name or nickname, to greet the person.', ...P },
    created_at: 'When they joined; drives retention.',
    ua: { purpose: 'Browser description. Not written any more; kept for old rows.', ...P },
    invite_id: 'Which invite code they joined with.',
    source: 'How they joined (self sign-up or counsellor-led).',
    counsellor_id: 'Which counsellor runs this student (students only).',
    klass: { purpose: 'Class or section, for counsellor-led students.', ...P },
    consent_on: 'Date the consent sheet was signed (students).',
    followup_ok: { purpose: 'Whether the consent covers follow-up checks (students).', retention: 'A student with this set keeps only name, class, consent date and follow-up notes after the retention period.' },
    ret_hash: { purpose: 'Keyed hash of the return code, so a returning student can find their last result.', who: ['nobody'] },
    tok_after: 'Sessions issued before this time stop working (log out everywhere, admin revoke).',
    track: { purpose: "Which product: empty means student, 'adult' means working adult.", planned: true },
    age_band: { purpose: 'Age band from the age check; used only to check fairness across groups, never for matching.', planned: true, ...P },
    email: { purpose: 'Normalised email address, needed to send sign-in codes. Adults only.', planned: true, ...P, who: ['nobody'] },
    email_hash: { purpose: 'Keyed hash of the email, for look-ups and the one-account-per-address rule.', planned: true, who: ['nobody'] },
    research_ok: { purpose: 'Whether the person agreed that their anonymous data may be used for research.', planned: true },
    key_v: { purpose: 'Which version of the session key signed their token (key rotation).', planned: true },
  }),
  table('events', 'live', { purpose: 'What a tester did in the app: ids, numbers and capped feedback. Never resume text.', retention: 'Same as the tester.', who: ['tester', 'owner', 'counsellor'], deletion: D, erase: { key: 'tester_id' } }, {
    id: 'Row number.', tester_id: 'Who did it.', session_id: 'Groups events of one visit.', ts: 'When (UTC milliseconds).', type: 'What kind of event.',
    data: { purpose: 'Event details: ids and numbers; for feedback, a capped text.', ...P }, eid: 'Client event id, so a repeat is stored once.',
  }),
  table('joins', 'live', { purpose: 'Recent sign-up attempts per network address bucket, to slow guessing of invite codes.', retention: 'Rows older than 24 hours are deleted on the next sign-up.', who: ['nobody'], deletion: 'Expires by itself after 24 hours.', erase: { key: null } }, {
    ip: { purpose: 'Network address (as received) of the attempt.', ...P }, ts: 'When.',
  }),
  table('invites', 'live', { purpose: 'Invite codes that let people join, with limits.', retention: 'Until the owner removes the invite.', who: ['owner'], deletion: 'The owner deletes the invite. Holds no personal data.', erase: { key: null } }, {
    id: 'Row number.', code: 'The invite code.', label: 'What the invite is for (a school, a group).', max_uses: 'How many people may use it.', uses: 'How many have.', expires_at: 'When it stops working.', active: 'On or off.', created_at: 'When made.',
    track: { purpose: "Whether the invite is for students (empty) or working adults ('adult').", planned: true },
  }),
  table('claims', 'live', { purpose: 'Facts from the data build that need a human check.', retention: 'Until the owner clears the review run.', who: ['owner'], deletion: 'Replaced when the review run is loaded again. Holds no personal data.', erase: { key: null } }, {
    id: 'Claim id.', run: 'Which review run.', batch: 'Batch number in the run.', field_key: 'Which fact.', statement: 'What the data says.', urls: 'Public sources.',
  }),
  table('claim_reviews', 'live', { purpose: 'Reviewer verdicts on claims.', retention: 'Until the owner clears the review run.', who: ['owner'], deletion: 'Removed with its run. Holds a reviewer label, not a tester.', erase: { key: null } }, {
    id: 'Row number.', claim_id: 'Which claim.', reviewer: 'Reviewer label chosen by the owner.', verdict: 'Right, wrong or unsure.', says: 'What the reviewer found.', checked_on: 'Date checked.', created_at: 'When saved.', applied: 'Whether the owner applied it.',
  }),
  table('meta', 'live', { purpose: 'Small settings, such as when the last purge ran.', retention: 'Kept as long as the service runs.', who: ['owner'], deletion: 'Not personal; not deleted per person.', erase: { key: null } }, { k: 'Setting name.', v: 'Setting value.' }),
  table('admin_fail', 'live', { purpose: 'Failed admin and counsellor key attempts, for the lock-out.', retention: 'Old rows are deleted on the next failed attempt.', who: ['nobody'], deletion: 'Expires by itself.', erase: { key: null } }, {
    ip: { purpose: 'Network address (as received) with a prefix saying which page.', ...P }, ts: 'When.',
  }),
  table('audit', 'live', { purpose: 'A log of admin actions, with no identity of testers.', retention: 'Kept as long as the service runs.', who: ['owner'], deletion: 'Not about a person. Written so that it never holds a tester id or name.', erase: { key: null } }, {
    id: 'Row number.', ts: 'When.', action: 'What happened (purge, invite made, deletion).', detail: 'Counts and settings only.',
  }),
  table('reviews', 'live', { purpose: 'A counsellor review of a student result (students only).', retention: 'Same as the tester.', who: ['counsellor', 'owner'], deletion: D, erase: { key: 'tester_id' } }, {
    id: 'Row number.', tester_id: 'Which student.', code: 'The result code reviewed.', counsellor: 'Counsellor name.', baseline: 'The counsellor view before seeing the result.', baseline_at: 'When.', app_top: 'The app top picks.',
    overlap: 'How many of the top 3 matched.', overlap6: 'How many of the top 6 matched.', missed: 'Careers the app missed.', wrong: 'Careers the app got wrong.', wrong_field: 'Which field was wrong.', use_it: 'Would the student use it.',
    notes: { purpose: 'Counsellor notes.', ...P }, reviewed_at: 'When reviewed.', counsellor_id: 'Which counsellor.', blind: 'Whether the review was blind.', career_note: { purpose: 'Counsellor note on a career.', ...P },
    sure: 'How sure the counsellor was.', sections: 'Which sections were useful.', view_after: 'The counsellor view after seeing the result.',
  }),
  table('counsellors', 'live', { purpose: 'Counsellor accounts (a name and a key hash).', retention: 'Until the owner switches the counsellor off and removes the row.', who: ['owner'], deletion: 'The owner removes the row. Not a tester.', erase: { key: null } }, {
    id: 'Row number.', name: { purpose: 'Counsellor name.', ...P }, invite_id: 'Which invite (school) they belong to.', key_hash: { purpose: 'Hash of the counsellor key.', who: ['nobody'] }, active: 'On or off.', created_at: 'When added.', last_used: 'When last used.',
  }),
  table('followups', 'live', { purpose: 'Follow-up checks months after the result (students whose consent covers it).', retention: 'Kept for the follow-up period even after other data is purged.', who: ['counsellor', 'owner'], deletion: D, erase: { key: 'tester_id' } }, {
    id: 'Row number.', tester_id: 'Which student.', months: 'Months after the result.', stream: 'Stream chosen.', used: 'Whether they used the result.', note: { purpose: 'Counsellor note.', ...P }, counsellor_id: 'Which counsellor.', created_at: 'When saved.',
  }),

  // Planned: SPEC section 10, migration 0001_adult.sql (T3.1).
  table('email_codes', 'planned', { purpose: 'The pending sign-in code for an address.', retention: 'Expires after 15 minutes; rows older than 24 hours are purged daily.', who: ['nobody'], deletion: 'Expires and is purged. Also deleted on me/delete when the hash matches.', erase: { key: 'email_hash' } }, {
    email_hash: 'Keyed hash of the address.', code_hash: { purpose: 'Keyed hash of the 6-digit code.', who: ['nobody'] }, link_hash: { purpose: 'Keyed hash of the sign-in link token.', who: ['nobody'] },
    expires_at: 'When the code stops working.', tries: 'Wrong tries so far (limit 5).', invite_id: 'Invite used to start.', age_band: { purpose: 'Age band carried to account creation.', ...P }, created_at: 'When made.',
  }),
  table('email_sends', 'planned', { purpose: 'How many codes were sent to an address per day, for limits.', retention: 'Rows older than 7 days are purged daily.', who: ['nobody'], deletion: 'Purged after 7 days. Also deleted on me/delete.', erase: { key: 'email_hash' } }, {
    email_hash: 'Keyed hash of the address.', day: 'Day (UTC).', n: 'Codes sent that day.',
  }),
  table('profiles', 'planned', { purpose: "A working adult's skills and choices: ids and levels only.", retention: 'Until the retention period ends or the person deletes it.', who: ['tester'], deletion: D, erase: { key: 'tester_id' } }, {
    tester_id: 'Whose profile.', v: 'Profile schema version.', rev: 'Edit counter (conflict check).', data: { purpose: 'The profile document, at most 32 KB: graph ids and levels; no resume text.', ...P }, job_release: 'Graph release the result was made with.', matcher_version: 'Matcher version used.', updated_at: 'When last saved.',
  }),
  table('under18', 'planned', { purpose: 'A count of refused under-18 attempts per invite per day. Nothing else is stored about them.', retention: 'Kept as counts only.', who: ['owner'], deletion: 'Not about a person; counts only.', erase: { key: null } }, {
    invite_id: 'Which invite.', day: 'Day (UTC).', n: 'Refusals.',
  }),
  table('ai_calls', 'planned', { purpose: 'How many AI reads a person made per day, for the daily limit and cost.', retention: 'Same as the tester.', who: ['owner'], deletion: D, erase: { key: 'tester_id' } }, {
    tester_id: 'Who.', day: 'Day (UTC).', n: 'Calls.', tokens: 'Tokens used (cost).',
    prompt_version: { purpose: "Which extraction prompt the latest call that day used, such as 'extract_v1' (ADR-17).", planned: true },
  }),
  table('ops_daily', 'planned', { purpose: 'Daily counters for operations: sign-ups, codes, AI calls, errors.', retention: 'Kept as long as the service runs.', who: ['owner'], deletion: 'Not about a person; counts only.', erase: { key: null } }, {
    day: 'Day (UTC).', metric: 'Counter name.', n: 'Count.',
  }),
];

export const byName = Object.fromEntries(INVENTORY.map(t => [t.table, t]));
export const isPlannedField = (t, f) => !!(byName[t] && byName[t].fields[f] && byName[t].fields[f].planned);
// Tables whose rows belong to a person, with the column that finds them. Deletion, export and the purge loop over this.
export const personTables = () => INVENTORY.filter(t => t.erase.key).map(t => ({ table: t.table, key: t.erase.key, status: t.status }));

// Compare the inventory with a real database (a D1-like object: prepare().bind().all()). Returns a list of problems; empty means they agree.
//  - every table and column in the database is in the inventory (live), and every live inventory entry exists;
//  - 'planned' entries do NOT exist yet (once the migration lands, change them to live);
//  - a table with a tester_id or email_hash column must have erase.key naming that column (so deletion finds it).
export async function inventoryProblems(db) {
  const bad = [], seen = new Set();
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND name <> 'd1_migrations'").all()).results.map(r => r.name);
  for (const name of tables) {
    seen.add(name); const inv = byName[name];
    if (!inv) { bad.push(`table ${name} is not in the data inventory`); continue; }
    if (inv.status === 'planned') bad.push(`table ${name} exists, so its inventory status must change from planned to live`);
    const cols = (await db.prepare('SELECT name FROM pragma_table_info(?)').bind(name).all()).results.map(r => r.name);
    for (const c of cols) {
      const f = inv.fields[c];
      if (!f) bad.push(`column ${name}.${c} is not in the data inventory`);
      else if (f.planned) bad.push(`column ${name}.${c} exists, so its inventory entry must change from planned to live`);
    }
    for (const [c, f] of Object.entries(inv.fields)) if (!f.planned && inv.status === 'live' && !cols.includes(c)) bad.push(`inventory lists ${name}.${c} but the database has no such column`);
    for (const key of ['tester_id', 'email_hash']) if (cols.includes(key) && inv.erase.key !== key && !(key === 'email_hash' && name === 'testers')) bad.push(`table ${name} holds ${key}, so its inventory erase.key must be ${key}`);
    if (name === 'testers' && inv.erase.key !== 'id') bad.push('testers must be erased by id');
  }
  for (const t of INVENTORY) if (t.status === 'live' && !seen.has(t.table)) bad.push(`inventory lists table ${t.table} but the database has none`);
  return bad;
}
