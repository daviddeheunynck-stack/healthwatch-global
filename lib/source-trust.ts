// Source trust classification — who published the URL behind an outbreak row, and how
// much the UI is allowed to claim for it.
//
// Deliberately dependency-free (no Next, no Supabase, no types/ imports): the badges on
// the public site are only as honest as this file, so it has to be runnable and checkable
// in isolation — see scripts/check-source-trust.mjs, which replays every row of the live
// outbreaks table through it before a change to the allowlists ships.
//
// lib/outbreaks.ts re-exports sourceStatus()/sourceName() from here; consumers keep
// importing them from "@/lib/outbreaks".

// A real, citable WHO Disease Outbreak News article, e.g.
// "https://www.who.int/emergencies/disease-outbreak-news/item/2026-DON606".
// Same pattern as scripts/cleanup-fictional-outbreaks.mjs's REAL_DON check.
const REAL_WHO_DON_SOURCE = /^https:\/\/www\.who\.int\/emergencies\/disease-outbreak-news\/item\/\d{4}-DON\d+$/i;

// Fake seed DON URLs look like /item/dengue-cotedivoire-2024 — no year-DONnumber pattern.
const FAKE_SEED_DON = /\/disease-outbreak-news\/item\/(?!\d{4}-DON)/i;

// sourceStatus() requires https:// — plain http:// is treated as unverified because it's
// trivially spoofable and most sources here (WHO, ECDC, national MoH sites) serve https.
// A few legitimate press domains we actually cite don't: their https:// certs fail (verified by
// hand, not a network fluke — see e.g. french.china.org.cn, Choléra/Tchad fix 2026-08-06, TLS
// error confirmed via both WebFetch and the Browser pane) while http:// serves the same content.
// Allowlisted by exact hostname (not substring — a domain here must not accidentally match an
// unrelated host). This set is a SCHEME exemption only, never a trust grant: a host listed here
// still has to appear in one of the publisher allowlists below to earn a tier above 'unverified'
// (french.china.org.cn is Xinhua, so it lands in GENERAL_PRESS_DOMAINS → 'press', not 'official').
// Add a domain here only after confirming its https:// genuinely doesn't work, not as a shortcut
// around fixing a URL.
const KNOWN_PRESS_DOMAINS_HTTP_OK = new Set<string>([
  "french.china.org.cn", // Xinhua's French service — https cert fails, http is the live site
]);

// ── Legally forbidden publishers ─────────────────────────────────────────────
// Hosts HealthWatch Global has no right to cite at all, for reasons that have nothing
// to do with how trustworthy they are. Checked BEFORE every allowlist below, so a host
// listed here can never reach 'official' or 'press' no matter what else matches it.
//
// reliefweb.int (UN OCHA) was in AUTHORITATIVE_SOURCE_DOMAINS until 2026-08-26. Its
// terms permit "personal, non-commercial use" only, with no right to redistribute or
// create derivative works over third-party copyrighted partner reports — the same legal
// shape as the ProMED cease-and-desist. Every INGESTION path was retired for this on
// 2026-07-06 (lib/reliefweb.ts, sync-signals, sync-endemic-data's Ethiopia fallback,
// sync-drc-sitrep's sitrep discovery) — but the ban was never taught to the classifier,
// so the manual verification path kept writing reliefweb.int into `outbreaks.source` and
// this file kept badging it "official source verified" with a live link. Four rows were
// created or re-sourced that way between 2026-08-18 and 2026-08-26 (Dengue in Wallis-and-
// Futuna, American Samoa, Vanuatu, Kiribati); three of them were STILL on the public site
// hours after being switched off, because deactivating a row keeps it displayed for 60
// days (see getOutbreaksCached in lib/outbreaks.ts) and the deactivation write itself
// refreshed the `updated_at` half of that window.
//
// A row demoted by this list is not "a source we downgraded" — it is a citation we must
// not publish. Re-source it or retire it; do not re-add the entry. See
// legal_reliefweb_noncommercial and project_reliefweb_reintroduction_2026_08_26.
const FORBIDDEN_SOURCE_DOMAINS: ReadonlySet<string> = new Set([
  "reliefweb.int",
]);

/**
 * True when `source` cites a publisher HWG is not permitted to cite. Exported so the
 * daily data-quality audit can name the offending rows without re-deriving the rule
 * from sourceStatusOf()'s output (a row can be 'unverified' for a dozen innocent
 * reasons — placeholder text, a blog, http:// — and only this one is a legal matter).
 */
export function isForbiddenSourceHost(source: string | null | undefined): boolean {
  try {
    return hostMatchesDomain(new URL(source || "").hostname.toLowerCase(), FORBIDDEN_SOURCE_DOMAINS);
  } catch {
    return false; // not a URL at all — no host to forbid
  }
}

// ── Publisher allowlists ─────────────────────────────────────────────────────
// sourceStatus() used to grant 'official' to any https:// URL, which made the
// "verified official source" badge a statement about the URL scheme rather than about
// the publisher. Found 2026-08-12: the Ebola/DRC row — the product's largest active
// outbreak (4 381 cases / 2 011 deaths) — carried a LinkedIn feed permalink as its
// source. https, therefore badged "official source verified", while being login-walled
// and unreadable for a client. The row was re-sourced to WHO AFRO sitrep n°13 that day
// and a census of the live table found no other social/blog source, but the classifier
// stayed wrong, so trust is now derived from the publisher instead of the scheme.
//
// Two matching modes, deliberately different:
//   *_DOMAINS — suffix match on a dot boundary (see hostMatchesDomain), so every
//     subdomain an agency publishes under is covered by one entry: cdn.who.int,
//     iris.who.int, applications.emro.who.int and www.afro.who.int all match "who.int".
//     Only for namespaces where every subdomain is necessarily the same publisher.
//   *_HOSTS — exact hostname, for authoritative content hosted on shared third-party
//     infrastructure where the parent domain says nothing about who published it:
//     worldhealthorg.shinyapps.io is WHO's dashboard account, *.shinyapps.io is anybody's.
//
// Every entry below is either a host already present in the outbreaks table or one a
// sync cron can write (checked against app/api/cron/sync-*), so introducing the allowlist
// degraded no displayed row — re-check with scripts/check-source-trust.mjs when editing.
const AUTHORITATIVE_SOURCE_DOMAINS: ReadonlySet<string> = new Set([
  // WHO HQ + regional offices + document/API hosts (who.int covers cdn., iris.,
  // apps., xmart-api-public., applications.emro., www.afro., www.emro. …)
  "who.int",
  // Regional / multilateral health agencies
  "paho.org",
  "africacdc.org",
  "ecdc.europa.eu",
  "efsa.europa.eu",
  // National public-health agencies and health ministries
  "polioeradication.org", // GPEI — WHO-led polio eradication partnership
  // National public-health agencies and health ministries
  "cdc.gov",             // US CDC, incl. wwwnc.cdc.gov (Travel Notices / EID) and wcmssearch.cdc.gov
  "cdc.gov.tw",          // Taiwan CDC (nidss.cdc.gov.tw) — sync-taiwan-cdc
  "cdc.gov.au",          // Australian CDC
  "ncdc.gov.ng",         // Nigeria CDC — sync-ncdc
  "usda.gov",            // USDA APHIS avian influenza, incl. publicdashboards.dl.usda.gov
  "santepubliquefrance.fr",
  "iss.it",              // Istituto Superiore di Sanità (epicentro.iss.it) — Italian West Nile bulletin
  "gov.uk",              // UKHSA publishes under www.gov.uk — sync-ukhsa
  "gov.br",              // Brazilian Ministry of Health arbovirus monitoring
  "mohfw.gov.in",        // India MoHFW, incl. ncvbdc.mohfw.gov.in
  "doh.gov.ph",          // Philippines DOH — NOT gov.ph as a whole: pna.gov.ph is the state
                         // news agency, a wire service, and belongs in the press tier below
  "moph.go.th",          // Thailand MOPH
  "mysa.gov.my",         // Malaysia iDengue (idengue.mysa.gov.my) — sync-malaysia-dengue
  "health.gov.lk",       // Sri Lanka MoH National Dengue Control Unit (dengue.health.gov.lk)
  "health.gov.ws",       // Samoa Ministry of Health dengue sitreps
  "minsa.gob.ni",        // Nicaragua Ministerio de Salud
  "dge.gob.pe",          // Peru MINSA — Dirección General de Epidemiología
  // Guatemala Ministerio de Salud Pública y Asistencia Social (MSPAS) —
  // epidemiologia.mspas.gob.gt publishes the ministry's own weekly arbovirus
  // surveillance bulletins (PDF). Found 2026-08-28 via data-quality's section
  // 4m the same way ccousp.cm was the day before: demoted to "unverified" for
  // lacking an allowlist entry, not for any real trust issue — .gob.gt is
  // Guatemala's official government TLD, same national-ministry shape as
  // minsa.gob.ni/dge.gob.pe above.
  "mspas.gob.gt",
  "endpolio.com.pk",     // Pakistan National Emergency Operation Centre (polio programme)
  // Sub-national health departments whose bulletins we cite. health.ny.gov's "Global Health
  // Update" is an official agency publication but a SECONDARY digest of PAHO/WHO figures —
  // the six Chikungunya rows on it would be better re-sourced upstream to PAHO.
  "health.ny.gov",
  // Academic / institutional surveillance systems publishing primary data
  "info.dengue.mat.br",  // InfoDengue — Fiocruz / FGV
  // Cameroon's Centre de Coordination des Opérations d'Urgences de Santé Publique
  // (CCOUSP) — created by ministerial order n°51 PM of 12 May 2020, publishes the
  // country's own outbreak sitreps (cholera, mpox, yellow fever, measles…) and lists
  // the Ministry of Public Health as its own parent link. National public-health
  // coordination body, not a newsroom — found 2026-08-27 via data-quality's new
  // section 4m (was demoted to 'unverified' for lacking an allowlist entry, not for
  // any real trust issue: verified live, the anti-bot 403 that blocked earlier
  // fetches is a hosting quirk, see reference_govt_sites_need_browser_user_agent).
  "ccousp.cm",
]);

const AUTHORITATIVE_SOURCE_HOSTS: ReadonlySet<string> = new Set([
  "worldhealthorg.shinyapps.io", // WHO's Shiny dashboards (global dengue surveillance, etc.)
]);

// Specialist health/epidemiology outlets whose reporting we cite as an authoritative
// read of the primary bulletins. Kept in their own set — not merged into
// AUTHORITATIVE_SOURCE_DOMAINS — because they are journalism, not agency publications:
// if the "official source" badge should ever stop covering them, demote this one set
// to 'press' and nothing else changes.
const SPECIALIZED_HEALTH_PRESS_DOMAINS: ReadonlySet<string> = new Set([
  "cidrap.umn.edu",      // CIDRAP, University of Minnesota
  "statnews.com",        // STAT News
]);

// General-interest press: real, named, checkable outlets — but a newsroom report, not
// a health-authority bulletin. Its own tier so the row stays visible and linked with an
// honest label, instead of either borrowing the official badge or being buried as
// 'unverified' alongside placeholder text.
const GENERAL_PRESS_DOMAINS: ReadonlySet<string> = new Set([
  "nationthailand.com",  // The Nation Thailand — sync-endemic-data leptospirosis fallback
  "gmanetwork.com",      // GMA News — sync-endemic-data Philippines dengue RSS
  "pna.gov.ph",          // Philippine News Agency — state wire service, not the health ministry
  "french.china.org.cn", // Xinhua FR (http-only, see KNOWN_PRESS_DOMAINS_HTTP_OK)
  "news.cn",             // Xinhua (english.news.cn); http-only URLs stay 'unverified'
  "tchadinfos.com",      // Chad — cholera coverage
  "lepaystchad.com",     // Chad — cholera coverage
  "franceinfo.fr",       // France Info — imported Ebola case coverage
  "samoanews.com",       // Samoa News — American Samoa dengue coverage
  "africa24tv.com",      // Africa24 — CAR cholera coverage
  // Added 2026-08-17, at merge time: rows for these two appeared in the live table after
  // this file's 2026-08-12 census, so the original allowlist pass never saw them. Both are
  // real, named regional newsrooms of the same kind already admitted above (Tchadinfos,
  // Africa24) — see scripts/check-source-trust.mjs output that caught them.
  "leadership.ng",       // Leadership (Nigeria) — Diphtheria/Nigeria coverage
  "237actu.com",         // 237actu (Cameroon) — Cholera/Cameroon coverage
  // Not a newsroom but not an authority either: a specialist vaccination-information site
  // run by clinicians, republishing SPC/WHO Pacific dengue figures. 'press' keeps the row
  // visible and linked without lending it the official badge; the Wallis-and-Futuna row on
  // it deserves re-sourcing to the SPC/WHO Pacific syndromic surveillance bulletin.
  "mesvaccins.net",
  // EnQuête+ (Senegal) — established national newsroom (print + digital), same tier
  // as Leadership/Tchadinfos/Africa24 above. Found 2026-08-27 via section 4m,
  // Diphtheria/Senegal coverage.
  "enqueteplus.com",
]);

/**
 * Suffix match on a dot boundary: "www.afro.who.int" matches the entry "who.int",
 * "notwho.int" does not. Walks the host's parent domains and stops before the bare
 * TLD, so no entry can ever be widened into "every .gov" by accident.
 */
function hostMatchesDomain(host: string, domains: ReadonlySet<string>): boolean {
  const parts = host.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (domains.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

/**
 * Four-tier source verification, keyed on the publisher (allowlisted host), not the URL scheme:
 *   'don'        — real WHO DON article (fully citable, citation button shown)
 *   'official'   — WHO sitrep / ECDC / PAHO / Africa CDC / national agency or ministry,
 *                  or a specialist health outlet (CIDRAP, STAT), with no DON id
 *   'press'      — general-interest news outlet: real and linkable, but not an authority
 *   'unverified' — anything else: placeholder text ("OMS", "PAHO"), fake seed URL, social
 *                  media, blogs, aggregators, http:// outside KNOWN_PRESS_DOMAINS_HTTP_OK
 */
export type SourceStatus = 'don' | 'official' | 'press' | 'unverified';

export function sourceStatusOf(source: string | null | undefined): SourceStatus {
  const src = source || "";
  if (REAL_WHO_DON_SOURCE.test(src)) return 'don';
  if (FAKE_SEED_DON.test(src)) return 'unverified';

  let host: string;
  try {
    const url = new URL(src);
    host = url.hostname.toLowerCase();
    if (url.protocol === "http:") {
      if (!KNOWN_PRESS_DOMAINS_HTTP_OK.has(host)) return 'unverified';
    } else if (url.protocol !== "https:") {
      return 'unverified';
    }
  } catch {
    return 'unverified'; // plain-text placeholder ("OMS", "PAHO/OPS nov. 2025 — …")
  }

  // Legal ban first: no allowlist below may rescue a forbidden publisher.
  if (hostMatchesDomain(host, FORBIDDEN_SOURCE_DOMAINS)) return 'unverified';

  if (AUTHORITATIVE_SOURCE_HOSTS.has(host)) return 'official';
  if (hostMatchesDomain(host, AUTHORITATIVE_SOURCE_DOMAINS)) return 'official';
  if (hostMatchesDomain(host, SPECIALIZED_HEALTH_PRESS_DOMAINS)) return 'official';
  if (hostMatchesDomain(host, GENERAL_PRESS_DOMAINS)) return 'press';
  return 'unverified';
}

/**
 * Human-readable name for the organisation that published the source URL.
 * Used for source attribution badges in the UI.
 */
export function sourceName(source: string | null | undefined): string {
  const src = source ?? "";
  // WHO — most specific first: DON article, then regional offices, then generic who.int.
  if (src.includes("who.int/emergencies/disease-outbreak-news")) return "WHO DON";
  if (src.includes("emro.who.int"))      return "WHO EMRO";
  if (src.includes("afro.who.int"))      return "WHO AFRO";
  // National / regional public-health agencies.
  // ORDER MATTERS: "ncdc.gov.ng", "cdc.gov.au" and "cdc.gov.tw" all contain the substring
  // "cdc.gov", so Nigeria CDC, Africa CDC, Australia CDC and Taiwan CDC must be checked
  // BEFORE the US CDC ("cdc.gov") catch-all below, otherwise their rows would be
  // mislabelled "US CDC".
  if (src.includes("ncdc.gov.ng"))       return "Nigeria CDC";
  if (src.includes("africacdc.org"))     return "Africa CDC";
  if (src.includes("cdc.gov.au"))        return "Australian CDC";
  if (src.includes("cdc.gov.tw"))        return "Taiwan CDC";      // nidss.cdc.gov.tw — sync-taiwan-cdc
  if (src.includes("cdc.gov"))           return "US CDC";          // cdc.gov + wwwnc.cdc.gov (Travel Notices / EID)
  if (src.includes("ecdc.europa.eu"))    return "ECDC";
  if (src.includes("efsa.europa.eu"))    return "EFSA";
  if (src.includes("paho.org"))          return "PAHO";
  if (src.includes("santepubliquefrance.fr")) return "Santé publique France";
  if (src.includes("gov.uk"))            return "UKHSA";
  if (src.includes("aphis.usda.gov"))    return "USDA APHIS";
  if (src.includes("mohfw.gov.in"))      return "India MoHFW";
  if (src.includes("gov.br"))            return "Brazil MoH";
  if (src.includes("cidrap.umn.edu"))    return "CIDRAP";
  if (src.includes("info.dengue.mat.br")) return "InfoDengue";
  if (src.includes("reliefweb.int"))     return "ReliefWeb";
  if (src.includes("doh.gov.ph"))        return "PH DOH";
  if (src.includes("moph.go.th"))        return "Thailand MOPH";
  if (src.includes("idengue.mysa.gov.my")) return "Malaysia iDengue";
  if (src.includes("epicentro.iss.it") || src.includes("iss.it")) return "ISS Italy";
  if (src.includes("health.gov.lk"))     return "Sri Lanka MoH";
  if (src.includes("health.gov.ws"))     return "Samoa MoH";
  if (src.includes("minsa.gob.ni"))      return "Nicaragua MINSA";
  if (src.includes("dge.gob.pe"))        return "Peru DGE";
  if (src.includes("endpolio.com.pk"))   return "Pakistan NEOC";
  if (src.includes("polioeradication.org")) return "GPEI";
  if (src.includes("health.ny.gov"))     return "NY State DOH";
  if (src.includes("statnews.com"))      return "STAT News";
  // General-interest press — 'press' tier in sourceStatus(), named here so the badge and
  // the academic citation string say which outlet rather than a vague "Official".
  if (src.includes("nationthailand.com")) return "The Nation Thailand";
  if (src.includes("gmanetwork.com"))    return "GMA News";
  if (src.includes("pna.gov.ph"))        return "Philippine News Agency";
  if (src.includes("french.china.org.cn") || src.includes("news.cn")) return "Xinhua";
  if (src.includes("tchadinfos.com"))    return "Tchadinfos";
  if (src.includes("lepaystchad.com"))   return "Le Pays";
  if (src.includes("franceinfo.fr"))     return "France Info";
  if (src.includes("samoanews.com"))     return "Samoa News";
  if (src.includes("africa24tv.com"))    return "Africa24";
  if (src.includes("leadership.ng"))     return "Leadership";
  if (src.includes("237actu.com"))       return "237actu";
  if (src.includes("mesvaccins.net"))    return "MesVaccins.net";
  // WHO's Shiny-hosted dashboards (global dengue surveillance, etc.) — the hostname carries
  // no "who.int", so without this they fell through to the generic label below.
  if (src.includes("worldhealthorg.shinyapps.io")) return "WHO";
  if (src.includes("who.int"))           return "WHO";
  // Unrecognised host: show the bare hostname rather than claiming "Official". This label
  // reaches the academic citation string on the outbreak page for EVERY row, including
  // 'unverified' ones — a LinkedIn permalink used to be cited there as "Official"
  // (found 2026-08-12 on the Ebola/DRC row). "linkedin.com" is at least true.
  try {
    return new URL(src).hostname.replace(/^www\./, "");
  } catch {
    return "Official"; // plain-text source, e.g. "OMS" — no host to show
  }
}
