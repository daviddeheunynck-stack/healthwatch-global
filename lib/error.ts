/**
 * Safe error-message extraction for `catch` blocks.
 *
 * TypeScript types caught values as `unknown` (not `Error`) because
 * JavaScript lets you `throw` anything — strings, plain objects, whatever a
 * third-party library feels like. Reaching for `catch (e: any)` to dodge that
 * just defers the crash: `e.message` throws a fresh `TypeError` the moment
 * something throws a non-Error value, right inside your error handler.
 *
 * Usage:
 *   try { ... }
 *   catch (err: unknown) {
 *     console.error("[my-route] failed:", errorMessage(err));
 *   }
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
