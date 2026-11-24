/** True only for the Anand Rathi Wealth listing. Other names must not enter the book. */
export function isAnandRathiSymbol(symbol: string): boolean {
  if (/anand\s*rathi/i.test(symbol)) return true;
  const compact = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.includes("ANANDRATHI");
}
