"use client";

import { groupExpiries } from "@/lib/display";

export function ExpirySelect({
  expiries,
  value,
  onChange,
}: {
  expiries: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const groups = groupExpiries(expiries);
  return (
    <label className="field">
      <span>Expiry</span>
      <select aria-label="Expiry" value={value} onChange={(event) => onChange(event.target.value)}>
        <optgroup label="Weekly">
          {groups.weekly.map((item) => (
            <option key={item.raw} value={item.raw}>
              {item.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Monthly">
          {groups.monthly.map((item) => (
            <option key={item.raw} value={item.raw}>
              {item.label}
            </option>
          ))}
        </optgroup>
        {groups.other.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}
