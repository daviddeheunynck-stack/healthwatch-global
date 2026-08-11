// ── Country population data ────────────────────────────────────────────────────
// Source: World Bank 2023 estimates (thousands of inhabitants).
// Used to compute incidence rate = cases / population × 100 000.
// Keys match Outbreak.country_en values from the database.
// Updated annually — last update: 2024.

const POPULATION_THOUSANDS: Record<string, number> = {
  // ── Africa ──────────────────────────────────────────────────────────────────
  "DR Congo":             105_625,
  "Nigeria":              223_804,
  "Ethiopia":             126_527,
  "Uganda":                48_582,
  "Tanzania":              65_497,
  "South Africa":          60_414,
  "Kenya":                 55_100,
  "Sudan":                 48_109,
  "Algeria":               45_606,
  "Morocco":               37_840,
  "Angola":                36_684,
  "Mozambique":            33_089,
  "Ghana":                 33_476,
  "Côte d'Ivoire":         27_478,
  "Cameroon":              27_198,
  "Madagascar":            28_915,
  "Niger":                 26_208,
  "Burkina Faso":          22_100,
  "Mali":                  22_414,
  "Malawi":                20_931,
  "Zambia":                20_569,
  "Senegal":               17_763,
  "Chad":                  18_279,
  "Somalia":               18_143,
  "Zimbabwe":              15_920,
  "Rwanda":                14_058,
  "Guinea":                13_954,
  "Benin":                 13_712,
  "Burundi":               13_238,
  "Tunisia":               12_458,
  "South Sudan":           10_748,
  "Togo":                   8_645,
  "Sierra Leone":           8_791,
  "Libya":                  6_812,
  "Congo":                  5_836,
  "Liberia":                5_418,
  "Mauritania":             4_615,
  "Eritrea":                3_748,
  "Namibia":                2_604,
  "Botswana":               2_630,
  "Gabon":                  2_341,
  "Lesotho":                2_281,
  "Guinea-Bissau":          2_026,
  "Equatorial Guinea":      1_496,
  "Mauritius":              1_261,
  "Djibouti":               1_001,
  "Eswatini":               1_201,
  "Comoros":                  852,
  "Réunion":                  918,
  "Cabo Verde":               587,
  "São Tomé and Príncipe":    228,
  "Seychelles":                98,

  // ── Asia ────────────────────────────────────────────────────────────────────
  "India":              1_441_720,
  "China":              1_412_600,
  "Indonesia":            277_534,
  "Pakistan":             231_402,
  "Bangladesh":           172_954,
  "Philippines":          115_435,
  "Vietnam":               98_186,
  "Thailand":              71_697,
  "Myanmar":               54_410,
  "South Korea":           51_740,
  "Iraq":                  42_164,
  "Saudi Arabia":          36_947,
  "Malaysia":              33_573,
  "Nepal":                 30_034,
  "Afghanistan":           42_240,
  "Yemen":                 33_696,
  "Uzbekistan":            35_300,
  "Cambodia":              16_713,
  "Jordan":                10_827,
  "Azerbaijan":            10_312,
  "Tajikistan":            10_143,
  "Israel":                 9_174,
  "Hong Kong":              7_413,
  "Laos":                   7_426,
  "Kyrgyzstan":             6_766,
  "Singapore":              5_917,
  "Timor-Leste":            1_321,
  "Maldives":                 524,
  "Bhutan":                   787,
  "Brunei":                   454,

  // ── Americas ────────────────────────────────────────────────────────────────
  "United States":        335_893,
  "Brazil":               215_313,
  "Mexico":               128_455,
  "Colombia":              52_215,
  "Argentina":             45_773,
  "Peru":                  33_715,
  "Venezuela":             28_302,
  "Chile":                 19_629,
  "Ecuador":               18_001,
  "Bolivia":               12_079,
  "Haiti":                 11_748,
  "Dominican Republic":    11_228,
  "Guatemala":             17_109,
  "Honduras":              10_278,
  "Paraguay":               7_356,
  "Nicaragua":              6_851,
  "El Salvador":            6_336,
  "Costa Rica":             5_213,
  "Panama":                 4_352,
  "Canada":                38_781,
  "Cuba":                  11_256,
  "Jamaica":                2_985,
  "Trinidad and Tobago":    1_534,
  "Guyana":                   793,
  "Suriname":                 614,
  "Americas (regional)":    0,      // regional — no incidence rate

  // ── Europe ──────────────────────────────────────────────────────────────────
  "Russia":               143_826,
  "Germany":               84_308,
  "France":                68_042,
  "United Kingdom":        67_736,
  "Italy":                 59_240,
  "Spain":                 47_422,
  "Ukraine":               43_531,
  "Poland":                41_026,
  "Romania":               19_051,
  "Netherlands":           17_618,
  "Belgium":               11_590,
  "Sweden":                10_551,
  "Czech Republic":        10_880,
  "Greece":                10_718,
  "Portugal":              10_247,
  "Hungary":                9_710,
  "Austria":                9_120,
  "Switzerland":            8_796,
  "Serbia":                 8_653,
  "Bulgaria":               6_465,
  "Denmark":                5_910,
  "Finland":                5_563,
  "Slovakia":               5_460,
  "Croatia":                4_008,
  "Norway":                 5_425,
  "Ireland":                5_056,
  "Georgia":                3_744,
  "Albania":                2_745,
  "North Macedonia":        2_086,
  "Moldova":                3_272,
  "Kosovo":                 1_775,
  "Bosnia and Herzegovina": 3_269,

  // ── Oceania ─────────────────────────────────────────────────────────────────
  "Australia":             26_439,
  "Papua New Guinea":      10_330,
  "New Zealand":            5_123,
  "Fiji":                     930,
  "Solomon Islands":          741,
  "Tonga":                    107,
  "Vanuatu":                  335,
  "Samoa":                    223,
  "Kiribati":                 134,
  "Micronesia":               113,
  "Marshall Islands":          42,
  "Palau":                     18,
  "Nauru":                     13,
  "Tuvalu":                    11,

  // ── Middle East ─────────────────────────────────────────────────────────────
  "Iran":                  87_923,
  "Turkey":                85_326,
  "Egypt":                105_914,
  "United Arab Emirates":   9_770,
  "Syria":                 21_324,
  "Lebanon":                5_592,
  "Kuwait":                 4_268,
  "Oman":                   4_576,
  "Qatar":                  2_695,
  "Bahrain":                1_463,
  "Palestine":              5_483,

  // ── Special / Global ────────────────────────────────────────────────────────
  "Global":               8_000_000, // world population — kept for completeness
  "Multiple countries":           0, // no incidence rate for multi-country
};

/**
 * Returns population in thousands for a given country_en value.
 * Returns null if unknown or 0 (multi-country / regional).
 */
export function getPopulationThousands(countryEn: string | null | undefined): number | null {
  if (!countryEn) return null;
  const pop = POPULATION_THOUSANDS[countryEn];
  if (pop === undefined || pop === 0) return null;
  return pop;
}

/**
 * Computes incidence rate: cases per 100,000 inhabitants.
 * Returns null if population unknown or cases = 0.
 */
export function getIncidenceRate(cases: number, countryEn: string | null | undefined): number | null {
  if (!cases || cases === 0) return null;
  const pop = getPopulationThousands(countryEn);
  if (!pop) return null;
  // pop is in thousands → multiply by 1000 for actual population
  return (cases / (pop * 1000)) * 100_000;
}
