export function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export type LogLevel = "info" | "warn" | "error" | "debug";

export function log(level: LogLevel, ridStr: string, msg: string, extra?: Record<string, unknown>) {
  const record = { level, rid: ridStr, msg, ...extra };
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](JSON.stringify(record));
}
