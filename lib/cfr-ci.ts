/**
 * Wilson score confidence interval for a proportion.
 * Appropriate for small samples (preferred over naive p ± z*se).
 * Returns [lower, upper] as percentages, or null if not meaningful.
 */
export function wilsonCI(
  deaths: number | null,
  cases: number,
  confidence = 0.95
): [number, number] | null {
  if (deaths === null || cases < 5 || deaths < 1 || deaths > cases) return null;

  const z  = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const p  = deaths / cases;
  const n  = cases;
  const z2 = z * z;

  const center    = (p + z2 / (2 * n)) / (1 + z2 / n);
  const halfWidth = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);

  return [
    parseFloat((Math.max(0, center - halfWidth) * 100).toFixed(1)),
    parseFloat((Math.min(100, center + halfWidth) * 100).toFixed(1)),
  ];
}
