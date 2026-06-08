# HealthWatch Global — Roadmap

> Internal notes. Not served publicly.

---

## Future data sources (post-ProMED)

**Context:** ProMED was removed in June 2026 following a cease-and-desist from
ISID/ProMED. The platform now runs on WHO Disease Outbreak News only. ProMED's
unique value was *speed* (event-based early detection). The sources below would
restore and exceed that — all government / intergovernmental, no licensing risk.

**Do NOT integrate until a prospect explicitly asks for faster-than-WHO detection.**
Adding sources is engineering effort that doesn't bring the first paying customer.

### Candidate sources (all public-sector)

| Source | Adds | Machine feed | Notes |
|---|---|---|---|
| **CDC Travel Health Notices** | Fast traveler alerts | RSS: `https://tools.cdc.gov/api/v2/resources/media/285676.rss` | US gov, public domain |
| **ECDC — Communicable Disease Threats Report (CDTR)** | Weekly global threat scan, EU lens | ECDC data portal + news RSS | EU public-sector info, attribution required |
| **PAHO** (WHO Americas) | Epidemiological alerts, Americas | RSS on paho.org alerts page | WHO regional office |
| **Africa CDC** | African outbreak briefs (often fast) | Web / PDF (no clean RSS) | African Union |
| **National health ministries** | Sometimes more current than WHO (e.g. DRC INSP) | Variable, per-country | Direct from source |

### ⚠️ Mandatory due-diligence before integrating ANY source

The ProMED lesson: **public ≠ free to redistribute commercially.**
For every new source, verify and document:

1. Public sector / open licence?
2. **Commercial** redistribution permitted?
3. Required attribution wording?
4. Rate limits / fair-use terms on the feed?

Keep a record of each source's terms-of-use check before it goes live.

---

## Other backlog items

- **Trend indicators (▲/▼)** — scheduled task fires ~12 June 2026; activates once
  outbreak_snapshots has ≥7 days of data. See `lib/outbreak-trend.ts`.
- **Team accounts** — 1 org / N users. Needs Stripe subscription model rework.
  Build when first institutional prospect requests it.
- **Outgoing webhooks (Enterprise)** — push to Notion/Airtable/Zapier on change.
- ~~**Stale message-file cleanup**~~ — audited 8 June: the `$199`/`$590` /
  `starter_price` keys this note originally flagged are already gone (cleared
  by the Starter-purge commits on 6 June). The one survivor, `plan.starter`
  ("Starter"/"Legacy"), is *not* dead — `Navbar.tsx` reads it live via
  `tAuth(\`plan.${plan}\`)` for any remaining grandfathered subscriber
  (see the `{ key: "starter", label: "Legacy" }` row in admin/page.tsx).
  Removing it would blank their plan badge. Nothing to clean up here;
  it stays until the last legacy "starter" profile is gone.

---

## Done (reference)

- ProMED fully removed (data, UI, DB columns, i18n, migrations) — June 2026
- Repriced to Free / Pro €49 / Enterprise
- Disease-specific alerts, watchlist, compare, PDF one-pager, embeddable widget,
  PNG share card, PHEIC badge, CFR + incidence rate
- Founding-member coupon FOUNDER29 (40% off forever, max 50, via ?coupon= URL)
