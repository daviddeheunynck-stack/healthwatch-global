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

// ── L'URL contenue dans un `source` ──────────────────────────────────────────
// `outbreaks.source` est du texte libre, pas une colonne d'URL. La vérification
// manuelle y écrit couramment l'URL SUIVIE de l'édition exacte du bulletin qui
// porte le chiffre — une information que l'URL seule ne donne pas, puisque la
// même page hebdomadaire est réécrite chaque semaine :
//
//   https://polioeradication.org/about-polio/polio-this-week/ (GPEI, Country updates as of 26 August 2026)
//
// Mesuré en prod le 2026-09-04 : 16 des 126 lignes affichées ont cette forme,
// dont 15 des 16 lignes polio. Le problème n'était pas l'annotation, utile et
// voulue, mais que rien ne séparait les deux moitiés : `new URL()` accepte la
// chaîne entière (elle encode les espaces), donc le classificateur trouvait bien
// le bon hôte et décernait sa pastille — pendant que les huit surfaces qui
// publient un lien (fiche, modale, pastilles du tableau, exports CSV/PDF, page
// d'impression, deux gabarits d'e-mail d'alerte) envoyaient la chaîne complète
// dans le `href`. Le lecteur atterrissait sur
// `…/polio-this-week/%20(GPEI,%20Country%20updates…)`, un chemin qui n'existe pas.
//
// Échoue en `null` plutôt qu'en URL devinée : une source sans URL en tête de
// chaîne ("OMS", "PAHO/OPS nov. 2025 — …") n'a pas de lien à publier, et c'est
// déjà ce que le tier 'unverified' dit d'elle.
export function sourceUrl(source: string | null | undefined): string | null {
  const match = /^https?:\/\/\S+/i.exec((source ?? "").trim());
  if (!match) return null;

  // La ponctuation qui termine la phrase, pas l'URL. Une parenthèse fermante
  // n'est retirée que si elle n'a pas d'ouvrante dans le candidat : certaines
  // URLs légitimes en contiennent (articles de type "…_(virus)").
  let candidate = match[0].replace(/[.,;:]+$/, "");
  while (candidate.endsWith(")") && !candidate.includes("(")) {
    candidate = candidate.slice(0, -1);
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return candidate;
  } catch {
    return null;
  }
}

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
  // news.un.org — found 2026-09-06 via data-quality's provenance section (Cholera/DR Congo,
  // 41,300 cases). Same shape as reliefweb.int above: the UN's own general Conditions
  // d'utilisation (news.un.org is a UN Secretariat site, not a distinct legal entity) grant
  // "des fins personnelles et non commerciales... sans octroyer le droit de revendre ou de
  // distribuer le Contenu" (David confirmed by fetching the page directly, WebFetch being
  // blocked on un.org from this session) — personal/non-commercial only, no redistribution
  // or derivative works, the exact restriction that got reliefweb.int banned. Never re-add;
  // re-source affected rows to a primary WHO/AFRO bulletin instead.
  "news.un.org",
]);

// ── Éditeurs interdits UNIQUEMENT sur un chemin précis ───────────────────────
// ncdc.gov.ng ne peut pas entrer dans FORBIDDEN_SOURCE_DOMAINS ci-dessus : la
// clause de confidentialité (trouvée 2026-09-02) est imprimée sur les PDF de
// sitrep eux-mêmes — « confidential, privileged … may not be used, published, or
// redistributed to the public » — et revendique le CONTENU, pas seulement la
// mise en forme du fichier. La page de listing expurgée du même domaine
// (ncdc.gov.ng/diseases/sitreps) ne porte pas cette clause et reste citable ;
// c'est elle qui a remplacé le PDF confidentiel dans le champ `source` de la
// ligne Fièvre de Lassa/Nigeria ce jour-là. Interdire tout le domaine aurait
// démoté cette page aussi, sans raison légale.
//
// Trouvé en écrivant ce garde-fou (2026-09-04) : ce remplacement de champ
// n'a pas résolu le fond du problème — le commentaire de sync-ncdc/route.ts
// le dit lui-même, « pointer vers [la page de listing] sans changer ce qui
// est extrait du PDF ne résoudrait pas le problème : le contenu lui-même,
// pas seulement l'URL du fichier, est revendiqué confidentiel ». La ligne
// Lassa/Nigeria reste donc à traiter côté données (voir
// project_ncdc_lassa_row_confidential_content_2026_09_04) ; ce garde-fou
// empêche seulement qu'une future re-source pointe de nouveau vers le PDF
// lui-même sans que le classificateur le remarque.
const FORBIDDEN_SOURCE_PATH_PATTERNS: ReadonlyArray<{ host: string; pathTest: RegExp; why: string }> = [
  {
    host:     "ncdc.gov.ng",
    pathTest: /\/sitreps\/.*\.pdf$/i,
    why:      "Sitrep NCDC (Nigeria) — clause de confidentialité imprimée sur le PDF, voir legal_ncdc_nigeria_confidential_sitreps_2026_09_02. La page de listing (ncdc.gov.ng/diseases/sitreps) n'est pas concernée.",
  },
];

function isForbiddenSourcePath(host: string, pathname: string): boolean {
  return FORBIDDEN_SOURCE_PATH_PATTERNS.some(
    (p) => hostMatchesDomain(host, new Set([p.host])) && p.pathTest.test(pathname),
  );
}

// ── Éditeurs qu'on n'a pas le droit de RÉCUPÉRER automatiquement ─────────────
// Catégorie distincte de la précédente, et jusqu'ici la seule des deux à n'avoir
// aucune existence en code. Ces éditeurs peuvent être cités — une vérification
// humaine qui lit le bulletin et recopie un chiffre reste l'arbitrage retenu par
// David pour chacun d'eux — mais leurs conditions interdisent l'usage commercial
// de leur contenu, donc aucun cron ne doit aller le chercher tout seul.
//
// Pourquoi une liste plutôt que des commentaires : le 2026-08-28, un fetcher
// GPEI a été ajouté à sync-who-regional pour combler le retard des lignes cVDPV
// africaines. La restriction de polioeradication.org était déjà écrite depuis le
// 2026-07-29 — dans le SKILL.md d'une routine — et le message de retrait du
// 2026-09-04 (0df093ae) le dit lui-même : elle « n'avait pas été recroisée au
// moment de construire ce cron un mois plus tard ». Le cron a vécu 7 jours. Une
// règle qui ne vit que dans la mémoire de celui qui l'a écrite n'est pas un
// garde-fou ; scripts/check-restricted-fetch.mjs lit cette liste et refuse un
// commit qui introduit une URL sur l'un de ces hôtes dans app/ ou lib/.
//
// `why` est du texte pour un humain qui lit le refus, pas un identifiant.
export const RESTRICTED_FETCH_DOMAINS: ReadonlyArray<{ domain: string; since: string; why: string }> = [
  {
    domain: "polioeradication.org",
    since:  "2026-07-29",
    why:    "GPEI — CGU : « not for sale or for use in conjunction with commercial purposes », autorisation écrite requise pour toute reproduction substantielle. Lignes polio en vérification manuelle (Afghanistan/Pakistan depuis toujours, les 13 cVDPV africaines depuis le 2026-09-04).",
  },
  {
    domain: "endpolio.com.pk",
    since:  "2026-07-29",
    why:    "Pakistan NEOC — même traitement manuel que GPEI, dont il reprend les chiffres.",
  },
  {
    domain: "cdc.gov.au",
    since:  "2026-07-12",
    why:    "CDC Australie — copyright : usage personnel ou interne seulement, « must not use … for any commercial purpose ». Décision de David : ligne Diphtérie/Australie rafraîchie à la main, pas de scraper (legal_cdc_australia_commercial_use_restriction).",
  },
  {
    domain: "ncdc.gov.ng",
    since:  "2026-09-02",
    why:    "Nigeria CDC — les sitreps PDF portent une clause de confidentialité (« confidential, privileged … may not be used, published, or redistributed »). sync-ncdc est suspendu ; ne jamais réingérer ces PDF (legal_ncdc_nigeria_confidential_sitreps_2026_09_02).",
  },
  {
    domain: "reliefweb.int",
    since:  "2026-07-06",
    why:    "UN OCHA — CGU non commerciales. Déjà interdit de citation (voir FORBIDDEN_SOURCE_DOMAINS) ; listé ici aussi pour que l'interdiction d'ingestion soit vérifiée mécaniquement et pas seulement documentée.",
  },
  {
    domain: "promedmail.org",
    since:  "2026-06",
    why:    "ProMED/ISID — mise en demeure reçue, source retirée intégralement en juin 2026. Aucune réintroduction sans accord écrit.",
  },
];

/**
 * True when `source` cites a publisher HWG is not permitted to cite. Exported so the
 * daily data-quality audit can name the offending rows without re-deriving the rule
 * from sourceStatusOf()'s output (a row can be 'unverified' for a dozen innocent
 * reasons — placeholder text, a blog, http:// — and only this one is a legal matter).
 */
export function isForbiddenSourceHost(source: string | null | undefined): boolean {
  const src = sourceUrl(source);
  if (!src) return false; // not a URL at all — no host to forbid
  try {
    const url = new URL(src);
    const host = url.hostname.toLowerCase();
    return hostMatchesDomain(host, FORBIDDEN_SOURCE_DOMAINS) || isForbiddenSourcePath(host, url.pathname);
  } catch {
    return false;
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
  // The Pacific Community (SPC) — the Pacific region's intergovernmental scientific and
  // technical organisation (27 members), whose Public Health Division runs the Pacific
  // Public Health Surveillance Network (PPHSN), PacNet and the Pacific Syndromic
  // Surveillance System. Added 2026-08-31 when four Oceania dengue rows were re-sourced
  // onto its Pacific epidemic alerts map (www.spc.int/phd/epidemics), the map being fed by
  // national reports shared with the PPHSN Coordinating Body focal point. Same regional-
  // agency shape as paho.org / africacdc.org above, and SPC is the co-author of the
  // WHO-branded "Dengue in the Pacific: Multicountry Situation" series — so this is going
  // UPSTREAM to the publisher, not sideways to an aggregator: reliefweb.int, which merely
  // hosted that same series, is forbidden above and stays forbidden.
  "spc.int",
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
  // Tanzania Ministry of Health (moh.go.tz) — found 2026-09-02 via data-quality's
  // provenance section the same way mspas.gob.gt was on 2026-08-28: a Rotavirus/
  // Tanzania row citing the ministry's own PDF sitrep was demoted to "unverified"
  // for lacking an allowlist entry, not for any real trust issue. .go.tz is
  // Tanzania's official government TLD, same national-ministry shape as
  // moph.go.th above. Verified via SQL against the live `outbreaks` table that
  // no other row's source contains "moh.go.tz" before adding it, per this
  // file's own check-source-trust.mjs precedent.
  "moh.go.tz",
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
  // Chile Ministerio de Salud (MINSAL) — found 2026-09-05 via data-quality's provenance
  // section, same shape as minsa.gob.ni/dge.gob.pe/mspas.gob.gt above: a Hantavirus/Chile
  // row citing the ministry's own health-alert announcement page, demoted to "unverified"
  // for lacking an allowlist entry, not for any real trust issue. Verified via SQL that no
  // other row's source contains "minsal.cl" before adding it.
  "minsal.cl",
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
  // WHO Health Emergencies Programme's Global Cholera and Acute Watery Diarrhoea (AWD)
  // Dashboard — same "shared third-party host, exact hostname only" shape as the Shiny
  // dashboard above, this time on Esri's ArcGIS Hub rather than shinyapps.io. Found
  // 2026-09-06 re-sourcing Cholera/DR Congo off news.un.org (banned the same day, see
  // FORBIDDEN_SOURCE_DOMAINS) — David confirmed the URL directly from the live dashboard.
  "who-global-cholera-and-awd-dashboard-1-who.hub.arcgis.com",
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
  // PressAfrik (Senegal) — established national newsroom (one of the country's
  // most-visited news sites, publishing since 2007), same tier as EnQuête+ above.
  // Found 2026-09-04 via [PROVENANCE]/[COUVERTURE]: the same Diphtheria/Senegal row
  // now cites this outlet rather than enqueteplus.com.
  "pressafrik.com",
  // Daily Monitor (Uganda) — established national newsroom, same tier as the others
  // above. Found 2026-08-29 re-sourcing Crimean-Congo Hemorrhagic Fever/Uganda off an
  // unattributed Outbreak News Today Substack post: this outlet independently named
  // the district health officer, contact-tracing count, and taskforce meeting date for
  // the Yumbe cluster the substack post only summarized without sourcing.
  "monitor.co.ug",
  // Tribune Online (Nigeria) — established national newsroom (Nigerian Tribune group,
  // publishing since 1949), same tier as Leadership above. Added 2026-09-04 on David's
  // explicit word, re-sourcing Lassa fever/Nigeria off the NCDC sitrep PDF whose
  // confidentiality clause was found 2026-09-02 — see
  // project_ncdc_lassa_row_confidential_content_2026_09_04. Article directly attributes
  // NCDC's week-33 2026 figures (1,035 cases / 252 deaths).
  "tribuneonlineng.com",
  // Euronews — major pan-European multilingual broadcaster, same tier as the national
  // newsrooms above. Found 2026-09-06 via data-quality's provenance section, West Nile
  // fever/Greece coverage.
  "euronews.com",
  // TRN (North Macedonia) and Gazeta de Sud / GdS (Romania) — established national/regional
  // newsrooms, same tier as the others above. Found 2026-09-06 via data-quality's provenance
  // section, West Nile fever/North Macedonia and /Romania coverage respectively.
  "trn.mk",
  "gds.ro",
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
  // L'annotation d'édition qui suit parfois l'URL (voir sourceUrl) ne fait pas
  // partie de l'adresse : classer la chaîne entière ferait échouer le test DON,
  // qui est ancré sur la fin de l'URL.
  const src = sourceUrl(source) ?? source ?? "";
  if (REAL_WHO_DON_SOURCE.test(src)) return 'don';
  if (FAKE_SEED_DON.test(src)) return 'unverified';

  let host: string;
  let pathname: string;
  try {
    const url = new URL(src);
    host = url.hostname.toLowerCase();
    pathname = url.pathname;
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
  if (isForbiddenSourcePath(host, pathname)) return 'unverified';

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
  if (src.includes("spc.int"))           return "Pacific Community (SPC)"; // incl. www.spc.int/phd/epidemics, phd./php.spc.int
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
  if (src.includes("moh.go.tz"))         return "Tanzania MoH";
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
  if (src.includes("who-global-cholera-and-awd-dashboard")) return "WHO";
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

// ── Attribution publiable ────────────────────────────────────────────────────
// Deux vues de la même colonne `source`, délibérément séparées :
//
//   sourceName()             — nomme l'éditeur, TOUJOURS. C'est ce dont l'audit
//                              quotidien a besoin : data-quality l'appelle
//                              précisément pour NOMMER la ligne fautive dans le
//                              mail interne ("… , ReliefWeb) — https://…").
//   publishableSource*()     — ce qu'on a le droit d'imprimer sur une surface
//                              client. `null` pour un éditeur interdit.
//
// Sans cette séparation, la seule façon d'empêcher la fuite serait de faire
// mentir sourceName(), ce qui aveuglerait l'audit qui doit dénoncer la ligne.
//
// Pourquoi ces accesseurs plutôt que le tier : jusqu'au 2026-08-29, le seul
// garde en place était `sourceStatus(o) !== "unverified"` sur le lien de la page
// foyer. Un éditeur interdit retombe bien en 'unverified' (voir sourceStatusOf),
// donc ce lien-là disparaissait — mais par ricochet d'un test qui parle de
// CONFIANCE, pas de DROIT. Les six surfaces qui ne consultent pas le tier
// (phrase "bulletin … du …", citation académique, pied de page du rapport Pro,
// exports CSV/PDF/HTML, modèle de notification RSI) publiaient l'attribution,
// URL cliquable comprise pour quatre d'entre elles. Vérifié en ligne le
// 2026-08-29 sur /fr/outbreak/fe6c7cdc-… (Dengue/Kiribati) : "bulletin ReliefWeb
// du 2026-06-24" et "Data source: ReliefWeb." rendus, lien absent.
//
// Une ligne privée d'attribution n'est pas dans un état durable : c'est une
// donnée à re-sourcer ou à retirer. Ces accesseurs empêchent la publication,
// ils ne réparent pas la ligne.

/** L'URL de source, ou `null` si son éditeur ne peut pas être cité. */
export function publishableSourceUrl(source: string | null | undefined): string | null {
  if (!source) return null;
  return isForbiddenSourceHost(source) ? null : sourceUrl(source);
}

/** Le nom de l'éditeur, ou `null` s'il ne peut pas être cité. */
export function publishableSourceName(source: string | null | undefined): string | null {
  if (!source) return null;
  return isForbiddenSourceHost(source) ? null : sourceName(source);
}

// ── Publiquement annoncées comme fournisseurs ────────────────────────────────
// Les quatre sources listées comme "Official data sources" sur /methodology
// (app/[locale]/methodology/page.tsx, tableau `sources`) — le nom ici est
// exactement la valeur que sourceName() renvoie pour cette source, pas un
// libellé recopié à part. Utilisé par data-quality section 4n pour vérifier
// qu'une source annoncée alimente au moins une ligne active, sur le même
// principe que la sonde de couverture GPEI (section 4j) : une affirmation
// publique invérifiée finit par diverger silencieusement de la base — c'est
// exactement ce qui est arrivé à Africa CDC (0 ligne active, trouvé 2026-09-02).
//
// `staleAfterDays` fixe le délai avant qu'un zéro actif devienne un signal :
// une source peut légitimement retomber à zéro (foyers clos) sans être en
// panne, donc la sonde n'alerte que si, en plus, aucune écriture (active ou
// non) n'est arrivée de cet éditeur depuis ce délai. Calé sur la fréquence que
// /methodology annonce elle-même pour chaque source — WHO DON tourne à
// l'heure, les trois autres sont hebdomadaires/par événement.
export const PUBLICLY_CLAIMED_SOURCES: ReadonlyArray<{ label: string; staleAfterDays: number }> = [
  { label: "WHO DON",    staleAfterDays: 3 },
  { label: "ECDC",       staleAfterDays: 14 },
  { label: "PAHO",       staleAfterDays: 14 },
  { label: "Africa CDC", staleAfterDays: 14 },
];
