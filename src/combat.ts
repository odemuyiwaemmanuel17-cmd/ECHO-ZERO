import { Box3, Ray, Vector3 } from "three";
import type { Run } from "./game";

export type Hit = {
  kind: "enemy" | "metal" | "glass" | "machinery" | "lock";
  id?: number;
  distance: number;
  point: [number, number, number];
};
export type Shot = {
  serial: number;
  at: number;
  weapon: number;
  origin: [number, number, number];
  hit: Hit | null;
};
export const FIRE_INTERVAL = 0.4;
export const CUTTER_RANGE = 32;
export function aimRay(
  x: number,
  y: number,
  z: number,
  yaw: number,
  pitch: number,
) {
  return new Ray(
    new Vector3(x, y, z),
    new Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ),
  );
}
export function boxHit(
  ray: Ray,
  min: [number, number, number],
  max: [number, number, number],
  kind: Hit["kind"],
  id?: number,
): Hit | null {
  const point = ray.intersectBox(
    new Box3(new Vector3(...min), new Vector3(...max)),
    new Vector3(),
  );
  if (!point) return null;
  return {
    kind,
    id,
    distance: point.distanceTo(ray.origin),
    point: point.toArray() as [number, number, number],
  };
}
/** Analytic enemy hitboxes stay independent of cosmetic meshes and animation. */
export function traceShot(
  r: Run,
  ray: Ray,
  range: number,
  surface?: Hit | null,
): Hit | null {
  const hits: Hit[] = [];
  if (surface) hits.push(surface);
  if (r.lockHP > 0) {
    const lock = boxHit(ray, [-0.46, 1.22, 29.48], [0.46, 2.04, 29.76], "lock");
    if (lock) hits.push(lock);
  }
  for (const e of r.enemies) {
    if (!e.active || e.hp <= 0) continue;
    const radius =
      e.type === "SENTINEL" ? 0.65 : e.type === "DRONE" ? 0.52 : 0.32;
    const bottom = e.type === "DRONE" ? 0.95 : 0.05,
      top = e.type === "DRONE" ? 1.8 : e.type === "SENTINEL" ? 2.5 : 2.25;
    const hit = boxHit(
      ray,
      [e.x - radius, bottom, e.z - radius],
      [e.x + radius, top, e.z + radius],
      "enemy",
      e.id,
    );
    if (hit) hits.push(hit);
  }
  // Structural boundaries also work in headless route tests.
  for (let i = 0; i < 7; i++) {
    const z = i * 12 + 6;
    for (const side of [-1, 1]) {
      const hit = boxHit(
        ray,
        [side < 0 ? -5 : 1.5, 0, z - 0.25],
        [side < 0 ? -1.5 : 5, 4.2, z + 0.25],
        "metal",
      );
      if (hit) hits.push(hit);
    }
    if (i === 4 && !r.power) {
      const hit = boxHit(ray, [-1.5, 0, z - 0.2], [1.5, 3.4, z + 0.2], "metal");
      if (hit) hits.push(hit);
    }
    if (i === 2 && r.lockHP > 0) {
      const hit = boxHit(ray, [-1.5, 0, z - 0.2], [1.5, 3.4, z + 0.2], "metal");
      if (hit) hits.push(hit);
    }
  }
  for (const [min, max] of [
    [
      [-5, -0.2, -6],
      [5, 0, 90],
    ],
    [
      [-5, 3.29, -6],
      [5, 3.5, 90],
    ],
    [
      [-5, 0, -6],
      [5, 3.4, -5.8],
    ],
    [
      [-5, 0, 89.8],
      [5, 3.4, 90],
    ],
  ] as [number[], number[]][]) {
    const hit = boxHit(
      ray,
      min as [number, number, number],
      max as [number, number, number],
      "metal",
    );
    if (hit) hits.push(hit);
  }
  return (
    hits
      .filter((h) => h.distance <= range)
      .sort((a, b) => a.distance - b.distance)[0] ?? null
  );
}

export function fireAllowed(phase: string, r: Run, blocked: boolean) {
  return (
    phase === "PLAYING" &&
    r.hasCutter &&
    !r.ending &&
    !blocked &&
    [1, 2, 3].includes(r.weapon) &&
    r.elapsed >= r.fireReadyAt
  );
}
