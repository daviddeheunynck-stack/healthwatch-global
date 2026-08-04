/**
 * Shared between app/api/track-auth-failure/route.ts (write side) and
 * app/api/cron/health-check/route.ts (read side) so the two can't drift.
 *
 * A closed allowlist of codes a real person produces themselves: wrong
 * password, weak password, an email already taken, as opposed to anything
 * the backend produced on its own. Defaults unknown/missing codes to
 * "system" on purpose: the 2026-08-04 incident (a leaked secret key
 * rejected by Supabase) surfaced through supabase-js as an ordinary AuthError
 * with whatever code that failure mode happens to carry, not one anyone can
 * enumerate in advance. An unrecognized code is exactly the shape a new,
 * previously-unseen failure takes, and undercounting it defeats the point of
 * this table. See marketing/product-ideas-log.md, 2026-08-04, idea 1.
 */
const LEGITIMATE_AUTH_ERROR_CODES = new Set([
  // signup: the person did this, not the backend
  "user_already_exists",
  "email_exists",
  "weak_password",
  "email_address_invalid",
  "email_address_not_authorized",
  "validation_failed",
  // shared rate limiting: Supabase's own abuse guard working as intended,
  // not evidence the auth backend itself is broken
  "over_email_send_rate_limit",
  "over_request_rate_limit",
  "too_many_requests",
  // login: wrong password/OTP is the single most common failure by far and
  // must never count as a system fault, or this alert is noise from day one
  "invalid_credentials",
  "email_not_confirmed",
  "otp_expired",
]);

export function isSystemAuthError(errorCode: string): boolean {
  return !LEGITIMATE_AUTH_ERROR_CODES.has(errorCode);
}
