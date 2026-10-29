"""Data age (SPEC 5.6). Small pure functions, so the matcher lane and the tests agree on the rules.

  rating_weight(age_years)           rule 3: after 3 years a rating loses 5 percent a year, down to 0.6
  signal_state(age_years, cadence)   5.5: greyed when older than twice its cadence, hidden when older than three times
  age_years(as_of, today)            as_of is YYYY-MM or YYYY-MM-DD (the middle of the month is used for YYYY-MM)
"""
import datetime


def age_years(as_of, today):
    p = [int(x) for x in as_of.split('-')]
    d = datetime.date(p[0], p[1], p[2] if len(p) > 2 else 15)
    return max(0.0, (today - d).days / 365.25)


def rating_weight(age):
    return max(0.6, 1 - 0.05 * max(0, age - 3))


def signal_state(age, cadence):
    if age > 3 * cadence: return 'hidden'
    if age > 2 * cadence: return 'grey'
    return 'fresh'
