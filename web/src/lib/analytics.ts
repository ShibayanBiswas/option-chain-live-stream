import type { ChainRow, ChainTotals } from "./types";

export function findAtmStrike(spot: number | null, strikes: number[]): number | null {
  if (spot === null || !Number.isFinite(spot) || strikes.length === 0) return null;
  let best = strikes[0]!;
  let bestDist = Math.abs(best - spot);
  for (const strike of strikes) {
    const dist = Math.abs(strike - spot);
    if (dist < bestDist) {
      best = strike;
      bestDist = dist;
    }
  }
  return best;
}

export function computePCR(rows: ChainRow[]): number | null {
  let ce = 0;
  let pe = 0;
  for (const row of rows) {
    ce += row.ce.oi ?? 0;
    pe += row.pe.oi ?? 0;
  }
  if (ce <= 0) return null;
  return pe / ce;
}

/** Approximate max-pain: strike where combined writer loss is minimized. */
export function computeMaxPain(rows: ChainRow[]): number | null {
  if (rows.length === 0) return null;
  let bestStrike = rows[0]!.strike;
  let bestPain = Number.POSITIVE_INFINITY;

  for (const candidate of rows) {
    let pain = 0;
    for (const row of rows) {
      const ceOi = row.ce.oi ?? 0;
      const peOi = row.pe.oi ?? 0;
      if (candidate.strike > row.strike) {
        pain += (candidate.strike - row.strike) * ceOi;
      }
      if (candidate.strike < row.strike) {
        pain += (row.strike - candidate.strike) * peOi;
      }
    }
    if (pain < bestPain) {
      bestPain = pain;
      bestStrike = candidate.strike;
    }
  }
  return bestStrike;
}

export function atmIv(rows: ChainRow[], atm: number | null): number | null {
  if (atm == null) return null;
  const row = rows.find((item) => item.strike === atm);
  if (!row) return null;
  const values = [row.ce.iv, row.pe.iv].filter((value): value is number => value != null && value > 0);
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildTotals(rows: ChainRow[], spot: number | null): ChainTotals {
  let ceOi = 0;
  let peOi = 0;
  let ceVolume = 0;
  let peVolume = 0;
  for (const row of rows) {
    ceOi += row.ce.oi ?? 0;
    peOi += row.pe.oi ?? 0;
    ceVolume += row.ce.volume ?? 0;
    peVolume += row.pe.volume ?? 0;
  }
  return {
    ceOi,
    peOi,
    ceVolume,
    peVolume,
    pcr: ceOi > 0 ? peOi / ceOi : null,
    maxPain: computeMaxPain(rows),
    atm: findAtmStrike(
      spot,
      rows.map((r) => r.strike),
    ),
  };
}
