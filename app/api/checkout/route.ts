import { NextResponse } from "next/server";
import Stripe from "stripe";
import { checkoutProductImageUrl } from "@/lib/checkout-session";
import { getStripe, isStripeCheckoutAvailable } from "@/lib/stripe";
import { getItem } from "@/lib/items";
import { canPurchaseItem } from "@/lib/purchase-mailto";

type CheckoutBody = {
  itemId?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  message?: string;
};

function trimMeta(value: string | undefined, max = 500) {
  return (value ?? "").trim().slice(0, max);
}

function checkoutErrorMessage(error: unknown) {
  if (error instanceof Stripe.errors.StripeError) {
    return error.message;
  }
  return "決済ページの作成に失敗しました。";
}

export async function POST(request: Request) {
  if (!isStripeCheckoutAvailable()) {
    return NextResponse.json(
      { error: "カード決済は現在準備中です。銀行振込またはメールでお問い合わせください。" },
      { status: 503 },
    );
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  const itemId = body.itemId?.trim() ?? "";
  const name = trimMeta(body.name, 120);
  const email = trimMeta(body.email, 254);
  const phone = trimMeta(body.phone, 40);
  const address = trimMeta(body.address, 200);
  const message = trimMeta(body.message);

  if (!itemId) {
    return NextResponse.json({ error: "商品が指定されていません。" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "お名前を入力してください。" }, { status: 400 });
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "メールアドレスを入力してください。" }, { status: 400 });
  }

  const item = await getItem("antiques", itemId);
  if (!item || !canPurchaseItem(item)) {
    return NextResponse.json({ error: "この商品は現在購入できません。" }, { status: 404 });
  }

  if (!item.price || item.price <= 0) {
    return NextResponse.json({ error: "価格が設定されていないため、カード決済できません。" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "ja",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "jpy",
            unit_amount: item.price,
            product_data: {
              name: item.title,
              description: item.description?.slice(0, 200) || undefined,
              images: checkoutProductImageUrl(origin, item.images[0])
                ? [checkoutProductImageUrl(origin, item.images[0])!]
                : undefined,
            },
          },
        },
      ],
      success_url: `${origin}/antiques/${item.id}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/antiques/${item.id}/purchase`,
      metadata: {
        itemId: item.id,
        category: "antiques",
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        customerAddress: address,
        customerMessage: message,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "決済ページを作成できませんでした。" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout]", error);
    return NextResponse.json({ error: checkoutErrorMessage(error) }, { status: 500 });
  }
}
