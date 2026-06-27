import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getItem } from "@/lib/items";
import { canPurchaseItem } from "@/lib/purchase-mailto";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "カード決済は現在準備中です。銀行振込またはメールでお問い合わせください。" },
      { status: 503 },
    );
  }

  let itemId: string;
  try {
    const body = (await request.json()) as { itemId?: string };
    itemId = body.itemId ?? "";
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  if (!itemId) {
    return NextResponse.json({ error: "商品が指定されていません。" }, { status: 400 });
  }

  const item = await getItem("antiques", itemId);
  if (!item || !canPurchaseItem(item)) {
    return NextResponse.json({ error: "この商品は現在購入できません。" }, { status: 404 });
  }

  if (!item.price || item.price <= 0) {
    return NextResponse.json({ error: "価格が設定されていないため、カード決済できません。" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const stripe = new Stripe(secret);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "jpy",
          unit_amount: item.price,
          product_data: {
            name: item.title,
            description: item.description?.slice(0, 200) || undefined,
            images: item.images[0] ? [`${origin}${item.images[0]}`] : undefined,
          },
        },
      },
    ],
    success_url: `${origin}/antiques/${item.id}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/antiques/${item.id}/purchase`,
    metadata: {
      itemId: item.id,
      category: "antiques",
    },
  });

  if (!session.url) {
    return NextResponse.json({ error: "決済ページを作成できませんでした。" }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
