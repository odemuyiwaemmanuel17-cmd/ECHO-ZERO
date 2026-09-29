import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import type { Run } from "./game";
import { audio } from "./audio";
/** Fixed eight-slot pool: shots never allocate particle objects during play. */
export function ShotEffects({ run }: { run: Run }) {
  const seen = useRef(0),
    cursor = useRef(0);
  const slots = useMemo(
    () =>
      Array.from({ length: 8 }, () => ({
        at: -100,
        point: new T.Vector3(),
        kind: "metal",
      })),
    [],
  );
  const points = useRef<T.Points>(null),
    light = useRef<T.PointLight>(null);
  const coords = useMemo(() => new Float32Array(8 * 12 * 3), []);
  useFrame(() => {
    const shot = run.shot;
    if (shot && shot.serial !== seen.current) {
      seen.current = shot.serial;
      if (shot.hit) {
        const slot = slots[cursor.current++ % slots.length];
        slot.at = shot.at;
        slot.point.set(...shot.hit.point);
        slot.kind = shot.hit.kind;
        audio.cueAt(
          shot.hit.kind === "glass" ? "glass" : "impact",
          slot.point.x,
          slot.point.z,
          run.x,
          run.z,
        );
      }
    }
    slots.forEach((slot, s) => {
      const age = run.elapsed - slot.at;
      for (let i = 0; i < 12; i++) {
        const offset = (s * 12 + i) * 3,
          alive = age >= 0 && age < 0.35;
        coords[offset] = alive
          ? slot.point.x + Math.sin(i * 31) * age * 1.2
          : 0;
        coords[offset + 1] = alive
          ? slot.point.y + Math.cos(i * 17) * age - age * age * 4
          : -100;
        coords[offset + 2] = alive
          ? slot.point.z + Math.cos(i * 23) * age * 1.2
          : 0;
      }
    });
    if (points.current)
      points.current.geometry.attributes.position.needsUpdate = true;
    if (light.current && shot?.hit) {
      light.current.position.set(...shot.hit.point);
      light.current.intensity =
        Math.max(0, 1 - (run.elapsed - shot.at) * 10) * 2;
    }
  });
  return (
    <group userData={{ ignoreShot: true }}>
      <points ref={points} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[coords, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#f8c589" size={0.035} toneMapped={false} />
      </points>
      <pointLight ref={light} distance={1.5} color="#f8be75" intensity={0} />
    </group>
  );
}
