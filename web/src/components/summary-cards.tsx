"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { formatCompact, formatNumber } from "@/lib/format";
import type { OptionChainSnapshot } from "@/lib/types";

export function SummaryCards({ snapshot }: { snapshot: OptionChainSnapshot | null }) {
  const totals = snapshot?.totals;
  const oiChange = totals ? totals.ceOiChg + totals.peOiChg : null;
  return (
    <div className="kpi-row">
      <Card label="Put Call Ratio" value={totals?.pcr ?? null} digits={2} />
      <Card label="Max Pain" value={totals?.maxPain ?? null} digits={0} text={formatNumber(totals?.maxPain ?? null, 0)} />
      <Card label="Call Interest" value={null} text={formatCompact(totals?.ceOi ?? null)} />
      <Card label="Put Interest" value={null} text={formatCompact(totals?.peOi ?? null)} />
      <Card label="Interest Change" value={oiChange} digits={0} signed />
      <Card label="At the Money IV" value={totals?.atmIv ?? null} digits={2} />
    </div>
  );
}

function Card({
  label,
  value,
  digits = 2,
  text,
  signed = false,
}: {
  label: string;
  value: number | null;
  digits?: number;
  text?: string;
  signed?: boolean;
}) {
  const reduce = useReducedMotion();
  const shown = useAnimatedNumber(value, reduce);
  const display =
    text ??
    (value == null || shown == null
      ? "—"
      : formatNumber(signed ? shown : shown, digits));
  const tone = signed && value != null && value !== 0 ? (value > 0 ? "tone-up" : "tone-down") : "";
  return (
    <motion.article className="kpi" whileHover={reduce ? undefined : { y: -2 }}>
      <p>{label}</p>
      <strong className={tone}>{display}</strong>
    </motion.article>
  );
}

function useAnimatedNumber(value: number | null, reduce: boolean | null): number | null {
  const [shown, setShown] = useState<number | null>(value);
  const from = useRef<number | null>(value);

  useEffect(() => {
    if (value == null) {
      setShown(null);
      from.current = null;
      return;
    }
    if (reduce || from.current == null) {
      setShown(value);
      from.current = value;
      return;
    }
    const startValue = from.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      const next = startValue + (value - startValue) * (1 - (1 - t) ** 2);
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduce, value]);

  return shown;
}
