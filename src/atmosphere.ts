import type { Run } from "./game";
export function encounterStage(run: Run) {
  if (run.sentinelEncounter === null) return "dormant";
  const age = run.elapsed - run.sentinelEncounter;
  return age < 4
    ? "power"
    : age < 6
      ? "flicker"
      : age < 7.6
        ? "stop"
        : age < 9
          ? "warning"
          : age < 21
            ? "crossing"
            : "clear";
}
const kinds = [
  "LIGHT_FLICKER",
  "DISTANT_IMPACT",
  "STEAM_RELEASE",
  "SCREEN_GLITCH",
  "DOOR_MALFUNCTION",
  "DISTANT_SENTINEL_STEP",
  "POWER_SURGE",
  "RADIO_STATIC",
] as const;
export function facilityEvent(run: Run) {
  if (
    run.elapsed < 25 ||
    (run.sentinelEncounter !== null && run.elapsed - run.sentinelEncounter < 25)
  )
    return null;
  const slot = Math.floor(run.elapsed / 32);
  if (slot % 4 === 3) return null;
  let hash = 2166136261;
  for (const c of run.seed + "/" + slot)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const age = run.elapsed - slot * 32 - (6 + (hash % 17));
  return age < 0 || age > 3.2
    ? null
    : { id: slot, kind: kinds[(hash >>> 8) % kinds.length], age };
}
