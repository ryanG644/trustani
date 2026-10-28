/** The products shown as tabs on the home page, in order. */
export const PRODUCTS = [
  { key: "common_bricks", label: "Common bricks", unit: "k1", per: "per 1,000", category: "cement_bricks" },
  { key: "stone19", label: "3/4 stone", unit: "m3", per: "per cube (m³)", category: "aggregates" },
  { key: "cement", label: "Cement", unit: "bag50", per: "per 50kg bag", category: "cement_bricks" },
  { key: "pit", label: "Pit sand", unit: "m3", per: "per cube (m³)", category: "aggregates" },
  { key: "river", label: "River sand", unit: "m3", per: "per cube (m³)", category: "aggregates" },
] as const;

export type ProductKey = (typeof PRODUCTS)[number]["key"];

export const UNIT_SHORT: Record<string, string> = {
  m3: "/m³", t: "/tonne", load7: "/7t load", load10: "/10t load", load30: "/30t load",
  k1: "/1,000", bag50: "/bag", each: " each",
};

export const TOP_N = 10;
