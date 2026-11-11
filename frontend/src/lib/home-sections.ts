/**
 * Which products the home page shows, and where. Products lead the page: one
 * row of new arrivals first, then one row of everything else, with nothing
 * shown twice. Pure, so it is unit-tested without a browser.
 */

export const PRIMARY_LIMIT = 6;
export const SECOND_LIMIT = 12;

type HasId = { id: number };

export interface HomeSource<T extends HasId> {
  new_arrivals?: T[];
  featured?: T[];
  trending?: T[];
}

export interface HomeSections<T extends HasId> {
  primary: { title: string; products: T[] };
  second: { title: string; products: T[] };
  empty: boolean;
}

function uniqueById<T extends HasId>(...lists: (T[] | undefined)[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
  }
  return out;
}

export function homeSections<T extends HasId>(data: HomeSource<T>): HomeSections<T> {
  const arrivals = uniqueById(data.new_arrivals);
  const featured = uniqueById(data.featured);
  const trending = uniqueById(data.trending);

  let title = "New arrivals";
  let lead = arrivals;
  if (!lead.length) {
    title = featured.length ? "Featured" : "Trending";
    lead = featured.length ? featured : trending;
  }
  const primary = lead.slice(0, PRIMARY_LIMIT);
  const shown = new Set(primary.map((item) => item.id));
  const second = uniqueById(trending, featured, arrivals)
    .filter((item) => !shown.has(item.id))
    .slice(0, SECOND_LIMIT);

  return {
    primary: { title, products: primary },
    second: { title: "Trending", products: second },
    empty: primary.length === 0,
  };
}
