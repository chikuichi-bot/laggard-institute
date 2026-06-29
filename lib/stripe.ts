import Stripe from "stripe";

export function isStripeCheckoutAvailable() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
}

export function getStripe() {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secret);
}
