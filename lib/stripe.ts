export function isStripeCheckoutAvailable() {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
