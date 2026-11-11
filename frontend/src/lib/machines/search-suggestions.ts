/**
 * Navbar search suggestions.
 * Replaces `suggestions`, `showSuggestions` and `activeIdx`, which let a slow
 * response reopen the dropdown after the user had cleared or closed it.
 * The debounce timer and the request stay in the component; it dispatches
 * RESULTS with the query it asked for, and a mismatching one is ignored.
 */

export const MIN_QUERY = 2;

export type CategorySuggestion = { type: "category"; label: string };
export type ProductSuggestion = {
  type: "product";
  label: string;
  sub: string;
  price: number;
  id: number;
  currency?: string;
};
export type Suggestion = CategorySuggestion | ProductSuggestion;

export type SearchState = {
  status: "closed" | "debouncing" | "open";
  /** The trimmed query the state is about. */
  query: string;
  /** Last results; kept while closed so focusing the field can reopen them. */
  items: Suggestion[];
  activeIdx: number;
};

export type SearchEvent =
  | { type: "INPUT"; query: string }
  | { type: "RESULTS"; query: string; items: Suggestion[] }
  | { type: "ARROW"; dir: 1 | -1 }
  | { type: "FOCUS" }
  | { type: "CLOSE" };

export const initialSearchState: SearchState = { status: "closed", query: "", items: [], activeIdx: -1 };

export function searchReducer(state: SearchState, event: SearchEvent): SearchState {
  switch (event.type) {
    case "INPUT": {
      const query = event.query.trim();
      if (query.length < MIN_QUERY) return { status: "closed", query, items: [], activeIdx: -1 };
      // An open list stays visible while the next results load.
      return state.status === "open"
        ? { ...state, query, activeIdx: -1 }
        : { status: "debouncing", query, items: state.items, activeIdx: -1 };
    }
    case "RESULTS": {
      if (state.status === "closed" || event.query !== state.query) return state;
      return event.items.length === 0
        ? { status: "closed", query: state.query, items: [], activeIdx: -1 }
        : { status: "open", query: state.query, items: event.items, activeIdx: -1 };
    }
    case "ARROW": {
      if (state.status !== "open") return state;
      const activeIdx = Math.max(-1, Math.min(state.activeIdx + event.dir, state.items.length - 1));
      return activeIdx === state.activeIdx ? state : { ...state, activeIdx };
    }
    case "FOCUS":
      return state.status === "closed" && state.query.length >= MIN_QUERY && state.items.length > 0
        ? { ...state, status: "open", activeIdx: -1 }
        : state;
    case "CLOSE":
      return state.status === "closed" ? state : { ...state, status: "closed", activeIdx: -1 };
  }
}

export function activeSuggestion(state: SearchState): Suggestion | null {
  return state.status === "open" ? state.items[state.activeIdx] ?? null : null;
}

export function categoryItems(items: Suggestion[]): CategorySuggestion[] {
  return items.filter((item): item is CategorySuggestion => item.type === "category");
}

export function productItems(items: Suggestion[]): ProductSuggestion[] {
  return items.filter((item): item is ProductSuggestion => item.type === "product");
}

/** Categories first, then products — the order the dropdown renders and navigates. */
export function toSuggestions(data: {
  products: { id: number; title: string; category: string; price: number; currency?: string }[];
  categories: string[];
}): Suggestion[] {
  return [
    ...data.categories.map((label): Suggestion => ({ type: "category", label })),
    ...data.products.map((p): Suggestion => ({
      type: "product", label: p.title, sub: p.category, price: p.price, id: p.id, currency: p.currency,
    })),
  ];
}
