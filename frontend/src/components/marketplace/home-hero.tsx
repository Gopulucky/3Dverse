"use client";

import Link from "next/link";
import { Download, Package } from "lucide-react";
import { heroSentence, printedTile, type StoreAvailability } from "@/lib/store-availability";
import { openAudiencePopup } from "@/lib/audience-schedule";

/**
 * The top of the home page: what the shop sells and the two ways to buy.
 * The space to the right is kept free for a 3D design to be added later.
 */
export function HomeHero({ availability }: { availability: StoreAvailability }) {
  const printed = printedTile(availability);
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="store-container">
        <div className="home-hero-copy">
          <h1 id="home-title" className="display">Ideas you can hold.</h1>
          <p className="home-hero-lead">{heroSentence(availability)}</p>
          <div className="home-tiles">
            <Link href="/marketplace?format=physical" className="home-tile home-tile--printed" data-state={printed.comingSoon ? "coming-soon" : "available"}>
              <Package aria-hidden="true" />
              <span><strong>Printed products</strong><small>{printed.caption}</small></span>
            </Link>
            <Link href="/marketplace?format=digital" className="home-tile home-tile--digital">
              <Download aria-hidden="true" />
              <span><strong>Digital models</strong><small>Files for your 3D printer</small></span>
            </Link>
          </div>
          {printed.comingSoon && <button type="button" className="market-text-link home-hero-ask" onClick={openAudiencePopup}>Tell us what you’d like us to make</button>}
        </div>
      </div>
    </section>
  );
}
