"use client";

import { groupExpiries } from "@/lib/display";

export function ExpirySelect({
  expiries,
  value,
  compact,
  onChange,
}: {
  expiries: string[];
  value: string;
  compact?: boolean;
  onChange: (value: string) => void;
}) {
  const groups = groupExpiries(expiries);
  const text = (label: string) => (compact ? shortLabel(label) : label);
  return (
    <select
      className="toolbar-select"
      aria-label="Expiry"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {groups.weekly.length > 0 ? (
        <optgroup label="Weekly">
          {groups.weekly.map((item) => (
            <option key={item.raw} value={item.raw}>
              {text(item.label)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {groups.monthly.length > 0 ? (
        <optgroup label="Monthly">
          {groups.monthly.map((item) => (
            <option key={item.raw} value={item.raw}>
              {text(item.label)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {groups.longDated.length > 0 ? (
        <optgroup label="Long dated">
          {groups.longDated.map((item) => (
            <option key={item.raw} value={item.raw}>
              {text(item.label)}
            </option>
          ))}
        </optgroup>
      ) : null}
      {groups.other.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

/** "08 Dec 2026 · 10 days" becomes "08 Dec" this year and "28 Sep 27" after it, so a phone select can show it. */
function shortLabel(label: string): string {
  const pretty = label.split(" · ")[0] ?? label;
  const match = pretty.match(/^(.*) (\d{4})$/);
  if (!match) return pretty;
  return match[2] === String(new Date().getFullYear()) ? match[1] : `${match[1]} ${match[2].slice(2)}`;
}
