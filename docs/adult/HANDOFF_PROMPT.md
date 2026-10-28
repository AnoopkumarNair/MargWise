# Opening prompt for an implementation session

Paste the text below as the first message of a new session on this repository.

---

You are implementing Margwise for working adults.

1. **Read first,** in this order: `CLAUDE.md`, `docs/adult/SPEC.md`, `docs/adult/BUILD_PLAN.md` and `docs/adult/TEST_PLAN.md`. Skim `docs/ARCHITECTURE.md` for the existing system. The older adult docs in `docs/` explain the reasoning; SPEC wins where they differ.
2. **Build slice S1 from the "Delivery slices" table in BUILD_PLAN.md** (T0.1 is done). Within the slice, work one ticket at a time. For each ticket:
   1. Restate in two lines what "done" means, from the ticket.
   2. Implement it, matching the surrounding code style.
   3. Write its tests from TEST_PLAN.md alongside the code, and run them plus the student regression commands in BUILD_PLAN's ground rules.
   4. Commit with a clear message naming the ticket (for example "T1.3 build_graph.py").
   5. Push to your assigned branch.
3. **Stop and ask me** at any ticket marked ASK, on any licence or terms question, or if a SPEC section 11 target cannot be met. Do not guess.
4. **Never** deploy, apply SQL to the live database, push to `main`, scrape LinkedIn, Indeed or Naukri, or send personal data to a free AI tier.
5. **If a download host is blocked,** tell me the host name and continue with the tickets that do not need it. Never replace real data with invented data.
6. **A slice is done only when it meets the Definition of Done in TEST_PLAN.md:** tests passing locally and in CI, a pull request with phone-width screenshots, the test summary, a 5-minute demo script and known limits.

This session's scope: slice S1 only. Stop when S1 meets its Definition of Done, open the pull request, and report.
