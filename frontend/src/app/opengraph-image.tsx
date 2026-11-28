import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} — ${BRAND.positioning}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0E1214",
        }}
      >
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "white", letterSpacing: -2, marginBottom: 40 }}>
          <span>{BRAND.wordmark.before}</span>
          <span style={{ color: "#FB923C" }}>{BRAND.wordmark.accent}</span>
          <span>{BRAND.wordmark.after}</span>
        </div>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "white", maxWidth: 900, lineHeight: 1.1 }}>
          {BRAND.tagline}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#A2ADB3", marginTop: 24 }}>
          {BRAND.positioning}
        </div>
      </div>
    ),
    { ...size }
  );
}
