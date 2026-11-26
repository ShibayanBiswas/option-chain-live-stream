export function splitPinned<T extends { symbol: string }>(rows: T[], pin: string): { lead: T[]; more: T[] } {
  return {
    lead: rows.filter((row) => row.symbol === pin),
    more: rows.filter((row) => row.symbol !== pin),
  };
}
