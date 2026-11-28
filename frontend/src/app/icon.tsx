import { ImageResponse } from "next/og";
import { LOGO } from "@/lib/logo-paths";

// The browser-tab icon is the short mark, "&3d", on a white tile as on the
// owner's specification sheet.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  const mark = LOGO.short;
  const width = 60;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", borderRadius: 12, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={width} height={(width * mark.height) / mark.width} viewBox={`0 0 ${mark.width} ${mark.height}`}>
          <path d={mark.ink} fill="#121619" fillRule="evenodd" />
          <path d={mark.accent} fill="#E86A17" fillRule="evenodd" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
