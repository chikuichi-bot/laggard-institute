"use client";

import { useEffect } from "react";

/** Home → 見知らぬ駅. Client redirect so static iOS export works. */
export default function HomePage() {
  useEffect(() => {
    const native =
      window.location.protocol === "capacitor:" ||
      window.location.protocol === "ionic:" ||
      window.location.protocol === "file:";
    window.location.replace(
      native ? "/lab/mishiranu-eki/" : "/lab/mishiranu-eki",
    );
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5eedc",
        color: "#1f1b17",
        fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", serif',
        letterSpacing: "0.12em",
      }}
    >
      <p>見知らぬ駅へ…</p>
    </main>
  );
}
