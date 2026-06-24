export type PlanProfile = {
  plan?: string | null;
  trial_ends_at?: string | null;
  stripe_subscription_id?: string | null;
};

/**
 * Returns the effective plan, treating expired trials as "free".
 * Use this instead of reading `profile.plan` directly on any route that gates on plan.
 */
export function resolvedPlan(profile: PlanProfile | null): string {
  const plan = profile?.plan ?? "free";
  if (
    plan !== "free" &&
    profile?.trial_ends_at &&
    new Date(profile.trial_ends_at).getTime() < Date.now() &&
    !profile?.stripe_subscription_id
  )
    return "free";
  return plan;
}
