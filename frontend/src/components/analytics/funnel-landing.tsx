"use client";

import { useEffect } from "react";
import { trackLanding } from "@/lib/track-client";

/** Records one anonymous "visit started" per browsing session. Renders nothing. */
export function FunnelLanding() {
  useEffect(() => { trackLanding(); }, []);
  return null;
}
