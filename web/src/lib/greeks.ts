function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const abs = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * abs);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-abs * abs);
  return 0.5 * (1 + sign * erf);
}

function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export type GreekSet = {
  price: number;
  delta: number;
  gamma: number;
  vega: number;
  theta: number;
};

/** Black-Scholes. `sigma` and `rate` are decimals. Exchange IV is a percent. */
export function blackScholes(input: {
  spot: number;
  strike: number;
  rate: number;
  sigma: number;
  timeYears: number;
  type: "call" | "put";
}): GreekSet | null {
  const { spot, strike, rate, sigma, timeYears, type } = input;
  if (!(spot > 0) || !(strike > 0) || !(sigma > 0) || !(timeYears > 0)) return null;

  const sqrtT = Math.sqrt(timeYears);
  const d1 = (Math.log(spot / strike) + (rate + 0.5 * sigma * sigma) * timeYears) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const pdf = normPdf(d1);
  const discount = Math.exp(-rate * timeYears);
  const gamma = pdf / (spot * sigma * sqrtT);
  const vega = (spot * pdf * sqrtT) / 100;

  if (type === "call") {
    const price = spot * normCdf(d1) - strike * discount * normCdf(d2);
    const delta = normCdf(d1);
    const theta = (-(spot * pdf * sigma) / (2 * sqrtT) - rate * strike * discount * normCdf(d2)) / 365;
    return { price, delta, gamma, vega, theta };
  }

  const price = strike * discount * normCdf(-d2) - spot * normCdf(-d1);
  const delta = normCdf(d1) - 1;
  const theta = (-(spot * pdf * sigma) / (2 * sqrtT) + rate * strike * discount * normCdf(-d2)) / 365;
  return { price, delta, gamma, vega, theta };
}

export const DESK_RATE = 0.065;

export function deltaFromIv(input: {
  spot: number | null;
  strike: number;
  ivPercent: number | null;
  days: number | null;
  type: "call" | "put";
  rate?: number;
}): number | null {
  if (input.spot == null || input.ivPercent == null || input.days == null || input.days <= 0) return null;
  const greek = blackScholes({
    spot: input.spot,
    strike: input.strike,
    rate: input.rate ?? DESK_RATE,
    sigma: input.ivPercent / 100,
    timeYears: input.days / 365,
    type: input.type,
  });
  return greek ? greek.delta : null;
}
