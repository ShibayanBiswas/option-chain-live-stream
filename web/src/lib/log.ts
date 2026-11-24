export function logEvent(
  level: "info" | "warn" | "error",
  msg: string,
  extra?: Record<string, unknown>,
) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...extra,
    }),
  );
}
