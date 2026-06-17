const WHO_DON_API = "https://www.who.int/api/news/diseaseoutbreaknews";

const params = new URLSearchParams({
  "sf_culture": "en",
  "$format": "json",
  "$orderby": "PublicationDateAndTime desc",
  "$top": "60",
});

const res = await fetch(`${WHO_DON_API}?${params}`, {
  headers: {
    "User-Agent": "HealthWatch-Global/1.0 (health surveillance; contact@healthwatch-global.com)",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

if (!res.ok) throw new Error(`HTTP ${res.status}`);
const json = await res.json();
const items = json.value || [];

console.log(`Total items fetched: ${items.length}\n`);

const interesting = items.filter((i) =>
  /mpox|monkeypox|dengue/i.test(i.Title) ||
  /congo|brazil/i.test(i.Title)
);

for (const item of interesting) {
  console.log(`[${item.PublicationDateAndTime}] ${item.Title}`);
  console.log(`  DonId: ${item.DonId}`);
  if (item.Summary) {
    const plain = item.Summary.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.log(`  Summary: ${plain.slice(0, 500)}`);
  }
  console.log("");
}

console.log("--- All titles (for context) ---");
for (const item of items) {
  console.log(`[${item.PublicationDateAndTime}] ${item.Title}`);
}
