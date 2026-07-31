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
          background: "#101114",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#6C71FD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 20,
            }}
          >
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <path d="M6 9H26" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M9 16H23" stroke="white" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
              <path d="M12 23H20" stroke="white" strokeWidth="2.6" strokeLinecap="round" opacity="0.7" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "white" }}>
            <span style={{ color: "#F76421" }}>3D</span>
            <span>Verse</span>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: "white", maxWidth: 900, lineHeight: 1.1 }}>
          {BRAND.tagline}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#A9B5C7", marginTop: 24 }}>
          {BRAND.positioning}
        </div>
      </div>
    ),
    { ...size }
  );
}
