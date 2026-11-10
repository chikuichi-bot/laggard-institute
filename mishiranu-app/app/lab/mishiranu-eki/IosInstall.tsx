"use client";

import { useEffect, useState } from "react";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

export function useIosInstallState() {
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    setIos(isIosDevice());
  }, []);

  return { standalone, ios, canInstallHint: ios && !standalone };
}

/** Registers the service worker once on the client. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => reg.update())
        .catch(() => {
          // Ignore registration failures in preview / insecure contexts.
        });
    }, 800);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}

type Props = {
  compact?: boolean;
};

export function IosInstallCard({ compact = false }: Props) {
  const { standalone, ios, canInstallHint } = useIosInstallState();

  if (standalone) {
    return (
      <section className="mishiranu-ios-install mishiranu-ios-install--ready" aria-label="アプリ表示">
        <p className="mishiranu-kicker">HOME SCREEN</p>
        <h3 className="mishiranu-ios-install-title">ホーム画面アプリで表示中</h3>
        {!compact ? (
          <p className="mishiranu-note">
            Safari の枠なしで開いています。画面が古いときは、一度ホーム画面のアイコンを消してから、Safari
            で開き直して「ホーム画面に追加」し直してください。
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mishiranu-ios-install" aria-label="iPhoneへの追加">
      <p className="mishiranu-kicker">iPHONE APP</p>
      <h3 className="mishiranu-ios-install-title">ホーム画面に追加してアプリ化</h3>
      <p className="mishiranu-note">
        {canInstallHint || ios
          ? "Safari で開いたまま、下の手順でホーム画面に置くと、見た目も起動もアプリになります（App Store 不要）。"
          : "iPhone の Safari でこのページを開き、共有からホーム画面に追加してください。"}
      </p>
      <ol className="mishiranu-ios-install-steps">
        <li>Safari の共有ボタン（□↑）をタップ</li>
        <li>「ホーム画面に追加」を選ぶ</li>
        <li>名前は「見知らぬ駅」のまま追加</li>
      </ol>
      <p className="mishiranu-note">
        開発用の Xcode プロジェクトはリポジトリの{" "}
        <code>mishiranu-app/ios</code> にあります（Mac で{" "}
        <code>npm run ios:open</code>）。
      </p>
    </section>
  );
}
