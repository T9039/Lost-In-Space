/** Small, deterministic age labels for telemetry rows. */
export function formatAge(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "unknown age";

  const deltaMs = now.getTime() - then;
  const future = deltaMs < 0;
  const seconds = Math.round(Math.abs(deltaMs) / 1000);

  if (seconds < 60) return future ? "in a moment" : "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return future ? `in ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return future ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return future ? `in ${days} days` : `${days} days ago`;
}
