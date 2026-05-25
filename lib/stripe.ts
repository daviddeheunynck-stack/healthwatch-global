import Stripe from "stripe";

const BOM = String.fromCharCode(65279);
const clean = (v: string | undefined) => (v || "").replace(new RegExp("^" + BOM), "").trim();

export const stripe = new Stripe(clean(process.env.STRIPE_SECRET_KEY), {
  apiVersion: "2026-04-22.dahlia",
  httpClient: Stripe.createFetchHttpClient(),
});
