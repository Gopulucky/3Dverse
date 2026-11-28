"use client";

import Link from "next/link";
import { Download, Package } from "lucide-react";
import { heroSentence, printedTile, type StoreAvailability } from "@/lib/store-availability";
import { openAudiencePopup } from "@/lib/audience-schedule";

/**
 * The top of the home page: what the shop sells, the two ways to buy, and the
 * brand photograph (beside the headline on wide screens, below it on a phone).
 */
export function HomeHero({ availability }: { availability: StoreAvailability }) {
  const printed = printedTile(availability);
  const printedLink = (
    <Link href="/marketplace?format=physical" className="home-tile home-tile--printed" data-state={printed.comingSoon ? "coming-soon" : "available"}>
      <Package aria-hidden="true" />
      <span><strong>Printed products</strong><small>{printed.caption}</small></span>
    </Link>
  );
  const digitalLink = (
    <Link href="/marketplace?format=digital" className="home-tile home-tile--digital">
      <Download aria-hidden="true" />
      <span><strong>Digital models</strong><small>Files for your 3D printer</small></span>
    </Link>
  );
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="store-container">
        <div className="home-hero-copy">
          <h1 id="home-title" className="display">Ideas you can hold.</h1>
          <p className="home-hero-lead">{heroSentence(availability)}</p>
          {/* Lead with what can be bought today: digital models while printing is closed. */}
          <div className="home-tiles">
            {printed.comingSoon ? <>{digitalLink}{printedLink}</> : <>{printedLink}{digitalLink}</>}
          </div>
          {printed.comingSoon && <button type="button" className="market-text-link home-hero-ask" onClick={openAudiencePopup}>Tell us what you’d like us to make</button>}
        </div>
        <div className="home-hero-photo">
          {/* Pre-sized copies in public/hero, so no image service is needed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/parcel-1600.webp" srcSet="/hero/parcel-800.webp 800w, /hero/parcel-1600.webp 1600w"
            sizes="(min-width: 64rem) 55vw, 100vw" width={1600} height={990} fetchPriority="high" decoding="async"
            alt="A white parcel with teal and orange tape and a card reading “Ideas you can hold.”, next to a 3D-printed desk organiser" />
        </div>
      </div>
    </section>
  );
}
