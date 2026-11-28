import { ImageResponse } from "next/og";
import { LOGO } from "@/lib/logo-paths";

// The home-screen icon: the short mark with room around it. Phones round the corners.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const mark = LOGO.short;
  const width = 136;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={width} height={(width * mark.height) / mark.width} viewBox={`0 0 ${mark.width} ${mark.height}`}>
          <path d={mark.ink} fill="#121619" fillRule="evenodd" />
          <path d={mark.accent} fill="#E86A17" fillRule="evenodd" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
