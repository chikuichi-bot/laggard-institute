import type Stripe from "stripe";
import { markItemSold } from "./purchases";
import { getStripe } from "./stripe";

/** Stripe が参照できる公開 URL のみ（localhost は不可） */
export function checkoutProductImageUrl(origin: string, imagePath?: string) {
  if (!imagePath) return undefined;
  try {
    const host = new URL(origin).hostname;
    if (host === "localhost" || host === "127.0.0.1") return undefined;
  } catch {
    return undefined;
  }
  return `${origin}${imagePath}`;
}

export type CheckoutCategory = "antiques" | "amappola";

export function isPaidCheckout(
  session: Stripe.Checkout.Session,
  expectedItemId: string,
  category: CheckoutCategory,
) {
  return (
    session.payment_status === "paid" &&
    session.metadata?.itemId === expectedItemId &&
    session.metadata?.category === category
  );
}

/** @deprecated use isPaidCheckout */
export function isPaidAntiqueCheckout(
  session: Stripe.Checkout.Session,
  expectedItemId: string,
) {
  return isPaidCheckout(session, expectedItemId, "antiques");
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/** 決済確認後（Webhook・完了ページ共通・冪等） */
export async function fulfillCheckout(
  sessionId: string,
  expectedItemId: string,
  category: CheckoutCategory,
) {
  const session = await retrieveCheckoutSession(sessionId);
  if (!isPaidCheckout(session, expectedItemId, category)) {
    return { fulfilled: false as const, session };
  }

  if (category === "antiques") {
    await markItemSold("antiques", expectedItemId);
  }

  return { fulfilled: true as const, session };
}

/** @deprecated use fulfillCheckout */
export async function fulfillAntiqueCheckout(sessionId: string, expectedItemId: string) {
  return fulfillCheckout(sessionId, expectedItemId, "antiques");
}
