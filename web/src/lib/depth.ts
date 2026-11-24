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

export function heatIntensity(value: number | null, values: number[]): number {
  if (!value) return 0;
  const volumes = values.filter((item) => item > 0).sort((a, b) => a - b);
  if (volumes.length === 0) return 0;
  const rank = volumes.filter((item) => item <= value).length / volumes.length;
  return Math.max(0.12, Math.min(1, rank));
}

export type ChainMarks = {
  callWall: number | null;
  putWall: number | null;
  moveStrike: number | null;
};

export function windowRows(rows: ChainRow[], atm: number | null, depth: "near" | "full"): ChainRow[] {
  if (depth === "full" || atm == null) return rows;
  const index = rows.findIndex((row) => row.strike === atm);
  if (index < 0) return rows;
  return rows.slice(Math.max(0, index - 18), Math.min(rows.length, index + 19));
}

export function chainMarks(rows: ChainRow[]): ChainMarks {
  let callWall: number | null = null;
  let putWall: number | null = null;
  let moveStrike: number | null = null;
  let callOi = 0;
  let putOi = 0;
  let move = 0;

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
    const jump = Math.max(Math.abs(row.ce.change ?? 0), Math.abs(row.pe.change ?? 0));
    if (jump > move) {
      move = jump;
      moveStrike = row.strike;
    }
  }

  return {
    callWall: callOi > 0 ? callWall : null,
    putWall: putOi > 0 ? putWall : null,
    moveStrike: move > 0 ? moveStrike : null,
  };
}
