import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b8b0a4",
          color: "#f9f4e6",
          fontSize: 92,
          fontFamily: "serif",
          letterSpacing: "0.06em",
        }}
      >
        駅
      </div>
    ),
    size,
  );
}
