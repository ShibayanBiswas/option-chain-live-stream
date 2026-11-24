import type { ChainRow } from "./types";

export function depthPercent(value: number | null, max: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0 || !(max > 0)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function volumeBands(values: number[]): { high: number; low: number } {
  const volumes = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (volumes.length < 4) return { high: Number.POSITIVE_INFINITY, low: 0 };
  return {
    high: volumes[Math.floor(volumes.length * 0.8)] ?? Number.POSITIVE_INFINITY,
    low: volumes[Math.floor(volumes.length * 0.2)] ?? 0,
  };
}

export function volumeClass(
  value: number | null,
  bands: { high: number; low: number },
): "zero" | "low" | "mid" | "high" {
  if (!value) return "zero";
  if (value >= bands.high) return "high";
  if (value <= bands.low) return "low";
  return "mid";
}

export type ChainMarks = {
  callWall: number | null;
  putWall: number | null;
};

/** Highest call OI is resistance. Highest put OI is support. */
export function chainMarks(rows: ChainRow[]): ChainMarks {
  let callWall: number | null = null;
  let putWall: number | null = null;
  let callOi = 0;
  let putOi = 0;
  for (const row of rows) {
    const ce = row.ce.oi ?? 0;
    const pe = row.pe.oi ?? 0;
    if (ce > callOi) {
      callOi = ce;
      callWall = row.strike;
    }
    if (pe > putOi) {
      putOi = pe;
      putWall = row.strike;
    }
  }
  return {
    callWall: callOi > 0 ? callWall : null,
    putWall: putOi > 0 ? putWall : null,
  };
}
