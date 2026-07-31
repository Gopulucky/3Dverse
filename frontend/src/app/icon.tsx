import { ImageResponse } from "next/og";

// 3DVerse glyph mark — a stacked-layer "3" built from the layer-line
// motif (see docs/brand/03-visual.md). Single-colour on the violet-9
// solid fill; this is the icon.tsx fallback for browsers/contexts that
// don't read favicon.ico.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 7,
          background: "#6366F1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
          <path d="M6 9H26" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M9 16H23" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.85" />
          <path d="M12 23H20" stroke="white" strokeWidth="2.8" strokeLinecap="round" opacity="0.7" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
