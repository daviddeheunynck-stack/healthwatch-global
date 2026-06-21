// ISO 8601 epidemiological week (Monday–Sunday)
// Returns "W25/2026" notation used in public health reporting

export function getEpiWeek(date: string | Date): string {
  const d = new Date(typeof date === "string" ? date : date.toISOString());
  // Thursday of the same week determines the ISO year + week
  const thursday = new Date(d);
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  const year = thursday.getFullYear();
  const jan4 = new Date(year, 0, 4); // Jan 4 is always in week 1
  const weekNum = Math.round((thursday.getTime() - jan4.getTime()) / 604_800_000) + 1;
  return `W${String(weekNum).padStart(2, "0")}/${year}`;
}
