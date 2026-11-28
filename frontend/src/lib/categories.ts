/**
 * The one list of product categories, in the order shoppers see them. The home
 * links and the catalogue filter both use it, so names and order always match.
 * The API's search suggestions are checked against it in a unit test.
 */
export const CATEGORIES = [
  "Tabletop", "Jewelry", "Cosplay", "Miniatures", "Home Decor", "Gadgets",
  "Architecture", "Engineering", "Medical", "Gaming", "Other",
] as const;

/** Known categories in list order, then any new names alphabetically, with "Other" always last. */
export function orderCategories(names: readonly string[]): string[] {
  const rank = (name: string) => {
    if (name === "Other") return CATEGORIES.length + 1;
    const index = (CATEGORIES as readonly string[]).indexOf(name);
    return index === -1 ? CATEGORIES.length : index;
  };
  return [...new Set(names.filter(Boolean))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
