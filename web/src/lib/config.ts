export type DeskScope = "all" | "core";

/** The only universe switch. "all" discovers every index option book. "core" is NIFTY and SENSEX. */
export function deskScope(env: string | undefined = process.env.DESK_SCOPE): DeskScope {
  return env === "core" ? "core" : "all";
}
