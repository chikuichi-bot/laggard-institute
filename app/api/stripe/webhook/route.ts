import { NextResponse } from "next/server";
import { markItemSold } from "@/lib/purchases";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import type { ItemCategory } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      const itemId = session.metadata?.itemId;
      const category = session.metadata?.category as ItemCategory | undefined;
      if (itemId && category === "antiques") {
        await markItemSold(category, itemId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
