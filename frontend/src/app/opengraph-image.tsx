import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { LOGO } from "@/lib/logo-paths";

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
        <div style={{ display: "flex", marginBottom: 48 }}>
          <svg width={640} height={(640 * LOGO.name.height) / LOGO.name.width} viewBox={`0 0 ${LOGO.name.width} ${LOGO.name.height}`}>
            <path d={LOGO.name.ink} fill="#E6EAEC" fillRule="evenodd" />
            <path d={LOGO.name.accent} fill="#FB923C" fillRule="evenodd" />
          </svg>
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
