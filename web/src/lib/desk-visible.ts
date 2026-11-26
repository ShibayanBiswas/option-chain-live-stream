/** Sidebar, pins, and search. Other discovered indexes stay off the desk. */
export function shownOnDesk<T extends { segment: string; symbol: string }>(rows: T[]): T[] {
  return rows.filter((item) => item.segment !== "INDEX" || item.symbol === "NIFTY" || item.symbol === "SENSEX");
}
