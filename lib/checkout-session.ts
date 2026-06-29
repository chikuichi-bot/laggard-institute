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

export function isPaidAntiqueCheckout(
  session: Stripe.Checkout.Session,
  expectedItemId: string,
) {
  return (
    session.payment_status === "paid" &&
    session.metadata?.itemId === expectedItemId &&
    session.metadata?.category === "antiques"
  );
}

export async function retrieveCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(sessionId);
}

/** 決済確認後に売約済みへ（Webhook・完了ページ共通・冪等） */
export async function fulfillAntiqueCheckout(sessionId: string, expectedItemId: string) {
  const session = await retrieveCheckoutSession(sessionId);
  if (!isPaidAntiqueCheckout(session, expectedItemId)) {
    return { fulfilled: false as const, session };
  }

  await markItemSold("antiques", expectedItemId);
  return { fulfilled: true as const, session };
}
