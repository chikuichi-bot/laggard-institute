import Link from "next/link";
import AdminShell from "@/components/AdminShell";
import { getStripeWebhookSecret, isStripeCheckoutAvailable } from "@/lib/stripe";

const tasks = [
  {
    href: "/admin/antiques",
    label: "古道具を登録",
    desc: "写真を撮って、商品ページを作る",
    primary: true,
  },
  {
    href: "/admin/city",
    label: "街で拾った物",
    desc: "路上の断片を記録する",
  },
  {
    href: "/admin/sea",
    label: "海で拾ったもの",
    desc: "漂着物を記録する",
  },
  {
    href: "/admin/edit",
    label: "掲載を編集",
    desc: "写真の削除・差し替え、タイトル変更",
  },
  {
    href: "/admin/news",
    label: "ニュースを編集",
    desc: "トップのお知らせを書き換える",
  },
];

const views = [
  { href: "/antiques", label: "古道具一覧" },
  { href: "/city", label: "街の一覧" },
  { href: "/sea", label: "海の一覧" },
];

export default function AdminHubPage() {
  const stripeKeySet = isStripeCheckoutAvailable();
  const stripeWebhookSet = Boolean(getStripeWebhookSecret());

  return (
    <AdminShell
      title="作業"
      tagline="iPhone から写真を送って、サイトを更新します。"
      backHref=""
    >
      <div className="admin-task-list">
        {tasks.map((task) => (
          <Link
            key={task.href}
            href={task.href}
            className={`admin-task-card${task.primary ? " admin-task-card--primary" : ""}`}
          >
            <span className="admin-task-label">{task.label}</span>
            <span className="admin-task-desc">{task.desc}</span>
          </Link>
        ))}
      </div>

      <section className="admin-section">
        <h2 className="admin-section-title">カード決済（Stripe）</h2>
        <ul className="admin-status-list">
          <li>STRIPE_SECRET_KEY: {stripeKeySet ? "設定済" : "未設定"}</li>
          <li>
            STRIPE_WEBHOOK_SECRET:{" "}
            {stripeWebhookSet ? "設定済" : "未設定（本番では推奨）"}
          </li>
        </ul>
        {!stripeKeySet ? (
          <>
            <ol className="admin-setup-steps">
              <li>
                <a
                  href="https://dashboard.stripe.com/test/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Stripe テスト API キー
                </a>
                を開き、「シークレットキー」（<code>sk_test_...</code>）をコピー
              </li>
              <li>
                プロジェクトの <code>.env.local</code> の <code>STRIPE_SECRET_KEY=</code>{" "}
                の右に貼り付け
              </li>
              <li>開発サーバーを再起動（<code>npm run dev</code>）</li>
            </ol>
            <p className="admin-section-note">
              Webhook（<code>whsec_...</code>）はローカルでは省略できます。決済完了ページで売約済みに更新されます。
              本番では Stripe ダッシュボードで{" "}
              <code>/api/stripe/webhook</code> に <code>checkout.session.completed</code>{" "}
              を登録してください。
            </p>
          </>
        ) : !stripeWebhookSet ? (
          <p className="admin-section-note">
            Webhook 未設定でも、決済完了ページで売約済みに更新されます。本番デプロイ後は Webhook
            の設定を推奨します。
          </p>
        ) : null}
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">掲載を確認</h2>
        <div className="action-bar">
          {views.map((view) => (
            <Link key={view.href} href={view.href} className="action-btn">
              {view.label}
            </Link>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
