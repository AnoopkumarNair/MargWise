# Add-ons for working adults: side roads and consultations

> Superseded where it differs by `docs/adult/SPEC.md` (the authoritative adult spec) and `docs/adult/BUILD_PLAN.md`.

Status on 28 Oct 2026: design only. Nothing below is built. Both come after the roads view works.

## The rule they must keep

Margwise's edge is independence: no money from colleges, placements or course providers, so nobody can buy a better position in someone's results (`PRICING_AND_MARKET.md`, the guardrails in `ADULT_TRACK.md`). Both add-ons are designed so that rule still holds:

- **No commission or affiliate fee from any course, credential, college, platform or employer.** Bridges and roads are never ordered by who pays.
- **Any money the person pays is shown up front,** with who receives it.
- **No personal data goes to a third party** without the person choosing that specific share, each time.

## 1. Side roads: earn from what you already know

**What it is.** A lens on the person's strong skills: work they could do part-time now, without leaving their job.

- **Kinds of side road:**
  - freelance projects;
  - consulting for small firms;
  - training or teaching;
  - content;
  - mentoring;
  - part-time roles.
- **For each one:**
  - which of the person's skills it uses;
  - typical rates in India, where a source exists;
  - the time it needs;
  - where such work is found;
  - what to check first, such as the employment contract's moonlighting clause and tax.

**Why it fits the product.** A side road is also the cheapest way to **test a career change before leaping.** Someone eyeing a "reset" road into product management can take one small paid product project first. Each main road can therefore show "Try it on the side first", with the side road that uses the same gap skills.

**Data.**

- **Graph.** A `work_mode` attribute on occupations and skills: full-time only, freelance-able, teachable, mentor-able. Derived from O*NET work context and checked by hand for the founder's industries first.
- **Rates.** Public reports and platform pages that publish rate guides, read by the counsel with the quote check, at `secondary` trust. Freelance platforms' listings are not scraped; their terms usually forbid it. A licensed feed or API is used only where one exists.
- **India gig and platform work.** Official and policy reports (for example NITI Aayog's work on the gig economy) for the overall picture.

**Guardrails.**

- **Show the contract check first.** Many Indian employment contracts restrict outside work. "Check your contract's outside-work clause before you start" appears on every side road.
- **No income promises.** Rates are ranges with sources and dates, never "earn ₹X".

## 2. Consultations: talk to someone who walked the road

**What it is.** An optional, paid call with a person who has actually made the move the user is considering, or who hires for that role. This is not generic career coaching. The asset is people from the founder's network who switched, and hiring managers from the network pulse.

**How it stays independent.**

| Concern | Rule |
| --- | --- |
| Money | The user pays a fixed, published fee per call. The mentor receives most of it, and Margwise keeps a disclosed platform share. There is no fee from employers, course providers or colleges, and none per hire |
| Influence on results | Mentors do not change roads, rankings or bridges. A road shows "talk to someone who made this move" only when a mentor exists, after the road is already ranked |
| Selling courses | Mentors may not sell or refer courses during calls. If they do, it is a reportable breach |
| Quality | Mentors are verified by the founder: the move was real, with a LinkedIn profile or a reference checked. Each call is rated afterwards, and mentors below a set rating are paused |
| Data | The user picks what the mentor sees (none, the target road only, or the profile summary) for each booking. Nothing is shared by default. Mentors agree in writing to use it only for the call |
| Safety | Calls go through a booking link and video tool, never personal numbers. Margwise has a report button and a written process for complaints |

**Why it matters commercially.** `PRICING_AND_MARKET.md` showed that a ₹99 one-off sale to individuals does not cover costs. A paid call with someone who has done the move is high-value, needs no school sales cycle, and pays mentors from the founder's own network. It may be the adult track's revenue model. Test it with 10 mentors and a fixed price before building any booking software (a form, a calendar link and a payment link are enough at first).

**Regulatory.**

- **DPDP.** Sharing with a mentor is a separate, per-booking consent. The notice must describe it.
- **Consumer protection.** Published prices, a refund rule (for example, a full refund if the mentor misses the call), and no promised outcomes ("this call will get you the job").
- **Tax.** Margwise's platform share is income. GST and mentor payouts need an accountant's advice before money moves.

## Build order

1. **Side roads:** `work_mode` tags for the founder's industries, then a "Try it on the side first" link on roads. No new data source.
2. **Consultations, by hand:** 10 verified mentors from the network, one price, a form, calendar and payment links. Measure demand and ratings for 6 weeks.
3. **Booking inside Margwise:** only if step 2 shows demand.

## Decision rules (frozen before data)

| Measure | Rule |
| --- | --- |
| Side roads | At least 25 percent of people who see a side road open it; record how many say they tried one at the 3-month follow-up |
| Consultations, demand | At least 5 percent of people who reach the roads view book a paid call within 6 weeks |
| Consultations, quality | The median rating is 4 out of 5 or higher. No unresolved safety or conduct complaint |
| Independence | Zero cases of money influencing a road, a bridge or a ranking. Audited by checking that the matcher's inputs contain no commercial fields |
