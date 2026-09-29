import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as T from "three";
import type { Run } from "./game";
import { usePresentation } from "./presentation";

/** A handful of translucent billboards; no post-processing or fluid simulation. */
export function Steam({
  run,
  position,
  boot = false,
}: {
  run: Run;
  position: [number, number, number];
  boot?: boolean;
}) {
  const sprites = useRef<(T.Sprite | null)[]>([]);
  const { reducedMotion } = usePresentation();
  const map = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(195,213,214,.38)");
    gradient.addColorStop(0.45, "rgba(160,185,197,.13)");
    gradient.addColorStop(1, "rgba(160,185,197,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }, []);
  useEffect(() => () => map.dispose(), [map]);
  useFrame(() => {
    sprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const t = (run.elapsed * 0.35 + i * 0.19) % 1;
      sprite.visible = !boot || run.elapsed < 8;
      sprite.position.set(
        Math.sin(i * 13 + t) * 0.35,
        t * 2,
        Math.cos(i * 8) * 0.2,
      );
      sprite.scale.set(1 + t * 1.3, 0.5 + t, 1);
      (sprite.material as T.SpriteMaterial).opacity = reducedMotion
        ? 0.1
        : Math.sin(t * Math.PI) * 0.4;
    });
  });
  return (
    <group position={position}>
      {[0, 1, 2, 3].map((i) => (
        <sprite
          key={i}
          ref={(s) => {
            sprites.current[i] = s;
          }}
        >
          <spriteMaterial
            map={map}
            transparent
            depthWrite={false}
            color="#a9c1ce"
          />
        </sprite>
      ))}
    </group>
  );
}
export function Sparks({
  run,
  position,
}: {
  run: Run;
  position: [number, number, number];
}) {
  const points = useRef<T.Points>(null);
  const { reducedMotion } = usePresentation();
  const coords = useMemo(() => new Float32Array(36), []);
  useFrame(() => {
    if (!points.current) return;
    const time = run.elapsed % 9;
    points.current.visible = !reducedMotion && time < 0.6;
    for (let i = 0; i < 12; i++) {
      const t = time + i * 0.012;
      coords[i * 3] = Math.sin(i * 17) * t * 0.9;
      coords[i * 3 + 1] = -t * t * 4;
      coords[i * 3 + 2] = Math.cos(i * 19) * t * 0.7;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={points} position={position}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[coords, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffc578" size={0.035} toneMapped={false} />
    </points>
  );
}
