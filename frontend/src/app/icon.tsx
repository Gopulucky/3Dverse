import { ImageResponse } from "next/og";

// The logo is the name alone, so the browser-tab icon is the one character of the
// name that is ours: a Tangerine "&" on the Deep teal (violet-9) tile. This is the
// icon.tsx fallback for browsers/contexts that don't read favicon.ico.
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
          background: "#0B4F56",
          color: "#E86A17",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 25,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        &amp;
      </div>
    ),
    { ...size }
  );
}
