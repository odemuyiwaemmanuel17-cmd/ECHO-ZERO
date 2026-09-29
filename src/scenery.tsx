import { encounterStage, facilityEvent } from "./atmosphere";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as T from "three";
import {
  roomAt,
  roomNames,
  target,
  type Run,
  type Entity,
  type Enemy,
} from "./game";
import { audio } from "./audio";
import { usePresentation } from "./presentation";
import { Steam, Sparks } from "./effects";
import { Containment } from "./containment";

type V = [number, number, number];
const textures = new Map<string, T.CanvasTexture>();
function texture(kind: string) {
  if (textures.has(kind)) return textures.get(kind)!;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = kind === "floor" ? "#414d52" : "#657077";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 45;
  for (let i = 0; i < 4500; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 256;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    ctx.fillStyle = `rgba(0,0,0,${(seed % 8) / 100})`;
    ctx.fillRect(x, seed % 256, 1 + (seed % 16), 1);
  }
  ctx.strokeStyle = "#1a262c";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 250, 250);
  if (kind === "floor") {
    for (let y = 15; y < 250; y += 12) {
      ctx.strokeStyle = "#27343b";
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(246, y);
      ctx.stroke();
    }
    for (const x of [13, 243])
      for (const y of [13, 243]) {
        ctx.fillStyle = "#abb3af";
        ctx.fillRect(x, y, 3, 3);
      }
  } else {
    ctx.fillStyle = "#39464c";
    ctx.fillRect(14, 226, 80, 5);
    ctx.fillRect(14, 238, 30, 3);
    ctx.fillStyle = "#a79870";
    ctx.fillRect(180, 12, 57, 3);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(kind === "floor" ? 5 : 2, kind === "floor" ? 6 : 1);
  tex.anisotropy = 4;
  textures.set(kind, tex);
  return tex;
}
export function Part({
  p = [0, 0, 0],
  s = [1, 1, 1],
  color = "#35444b",
  rotation = [0, 0, 0],
  glow = false,
  map,
  surface = "steel",
}: {
  p?: V;
  s?: V;
  color?: string;
  rotation?: V;
  glow?: boolean;
  map?: string;
  surface?:
    | "steel"
    | "rubber"
    | "plastic"
    | "concrete"
    | "ceramic"
    | "fabric"
    | "copper"
    | "aluminum";
}) {
  return (
    <mesh position={p} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={color}
        map={map ? texture(map) : undefined}
        metalness={
          {
            steel: 0.55,
            rubber: 0,
            plastic: 0,
            concrete: 0,
            ceramic: 0.05,
            fabric: 0,
            copper: 0.92,
            aluminum: 0.86,
          }[surface]
        }
        roughness={
          {
            steel: 0.66,
            rubber: 0.94,
            plastic: 0.48,
            concrete: 0.97,
            ceramic: 0.23,
            fabric: 1,
            copper: 0.36,
            aluminum: 0.32,
          }[surface]
        }
        bumpMap={map ? texture(map) : undefined}
        bumpScale={map === "floor" ? 0.015 : 0.004}
        emissive={glow ? color : "#000"}
        emissiveIntensity={glow ? 1.5 : 0}
      />
    </mesh>
  );
}
function Tube({
  p,
  r = 0.07,
  length = 1,
  color = "#697572",
  rotation = [0, 0, Math.PI / 2],
}: {
  p: V;
  r?: number;
  length?: number;
  color?: string;
  rotation?: V;
}) {
  return (
    <mesh position={p} rotation={rotation} castShadow>
      <cylinderGeometry args={[r, r, length, 10]} />
      <meshStandardMaterial color={color} metalness={0.75} roughness={0.4} />
    </mesh>
  );
}
function Ring({
  p,
  r = 1,
  color = "#4a6067",
  rotation = [0, 0, 0],
}: {
  p: V;
  r?: number;
  color?: string;
  rotation?: V;
}) {
  return (
    <mesh position={p} rotation={rotation}>
      <torusGeometry args={[r, 0.06, 6, 40]} />
      <meshStandardMaterial color={color} metalness={0.7} roughness={0.36} />
    </mesh>
  );
}
function Sign({
  text,
  p,
  width = 2,
  height = 0.6,
  rotation = [0, Math.PI, 0],
  color = "#bdded2",
  screen = false,
}: {
  text: string;
  p: V;
  width?: number;
  height?: number;
  rotation?: V;
  color?: string;
  screen?: boolean;
}) {
  const tex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const c = canvas.getContext("2d")!;
    c.fillStyle = screen ? "#091b20" : "#17282e";
    c.fillRect(0, 0, 1024, 256);
    c.strokeStyle = color;
    c.lineWidth = 3;
    c.strokeRect(12, 12, 1000, 232);
    c.fillStyle = color;
    c.font = "bold 54px monospace";
    text.split("|").forEach((line, i) => c.fillText(line, 35, 86 + i * 75));
    if (screen) {
      c.globalAlpha = 0.13;
      for (let y = 0; y < 256; y += 5) c.fillRect(0, y, 1024, 1);
    }
    return new T.CanvasTexture(canvas);
  }, [text, color, screen]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={p} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
export function Asset({
  name,
  p = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  animate = 0,
}: {
  name: string;
  p?: V;
  rotation?: V;
  scale?: number;
  animate?: number;
}) {
  const { nodes } = useGLTF("/models/facility.glb");
  const object = useMemo(() => {
    const o = nodes[name].clone(true);
    o.traverse((n) => {
      if (n instanceof T.Mesh) {
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    return o;
  }, [nodes, name]);
  useFrame((_, dt) => {
    const rotor = object.getObjectByName("rotor");
    if (rotor)
      rotor.rotation.y = T.MathUtils.damp(
        rotor.rotation.y,
        animate,
        14,
        Math.min(dt, 0.05),
      );
    const lid = object.getObjectByName("podLid");
    if (lid) lid.position.x = Math.min(1, animate) * 1.7;
  });
  return (
    <primitive
      object={object}
      position={p}
      rotation={rotation}
      scale={scale}
      dispose={null}
    />
  );
}
function Cable({
  points,
  color = "#111b20",
  radius = 0.025,
}: {
  points: V[];
  color?: string;
  radius?: number;
}) {
  const geometry = useMemo(
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        16,
        radius,
        5,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
const roomTitles = [
  "CONTAINMENT / 01",
  "MEDICAL / 02",
  "STORAGE / 03",
  "SECURITY / 04",
  "GENERATOR / 05",
  "RESEARCH / 06",
  "SERVER CORE / 07",
  "EXTRACTION / 08",
];
function Door({ z, index, run }: { z: number; index: number; run: Run }) {
  const left = useRef<T.Group>(null),
    right = useRef<T.Group>(null);
  const amount = useRef(0),
    wasOpen = useRef(false),
    requestedAt = useRef<number | null>(null);
  const worldZ = z + index * 12;
  const variant = [
    "CONTAINMENT",
    "STANDARD",
    "SECURITY",
    "SECURITY",
    "MAINTENANCE",
    "STANDARD",
    "CONTAINMENT",
  ][index];
  const locked = (index === 4 && !run.power) || (index === 2 && run.lockHP > 0);
  useFrame((_, dt) => {
    const phase = encounterStage(run);
    const closing =
      index === 3 &&
      ["flicker", "stop", "warning", "crossing"].includes(phase) &&
      Math.abs(run.z - worldZ) > 2;
    const malfunction =
      facilityEvent(run)?.kind === "DOOR_MALFUNCTION" &&
      index === 2 &&
      Math.abs(run.z - worldZ) > 2;
    const request =
      !locked &&
      !closing &&
      !malfunction &&
      ((index === 4 && run.power) ||
        Math.abs(run.z - worldZ) < (index === 3 ? 8 : 4.8));
    if (request && requestedAt.current === null)
      requestedAt.current = run.elapsed;
    if (!request) requestedAt.current = null;
    const open =
      request &&
      run.elapsed - requestedAt.current! >
        (variant === "STANDARD" ? 0.15 : 0.4);
    amount.current = T.MathUtils.damp(
      amount.current,
      open ? 1 : 0,
      5,
      Math.min(dt, 0.05),
    );
    if (left.current) left.current.position.x = -0.85 - amount.current * 1.8;
    if (right.current) right.current.position.x = 0.85 + amount.current * 1.8;
    if (open !== wasOpen.current && Math.abs(run.z - worldZ) < 8) {
      audio.cueAt("door", 0, worldZ, run.x, run.z);
      if (open && variant === "CONTAINMENT")
        audio.cueAt("steam", 0, worldZ, run.x, run.z);
      wasOpen.current = open;
    }
  });
  return (
    <group position={[0, 0, z]}>
      {index === 2 && run.lockHP > 0 && (
        <group userData={{ ignoreShot: true }}>
          <Part
            p={[0, 1.63, -0.37]}
            s={[0.92, 0.82, 0.24]}
            color={run.lockHP === 90 ? "#a57e33" : "#5e4127"}
          />
          {[0, 1, 2].map((n) => (
            <Part
              key={n}
              p={[-0.27 + n * 0.27, 1.63, -0.51]}
              s={[0.12, 0.56, 0.025]}
              color={run.lockHP / 30 > n ? "#e6ae50" : "#1c2020"}
              glow={run.lockHP / 30 > n}
            />
          ))}
          <Sign
            text="DAMAGED LOCK|CUT TO RELEASE"
            p={[0, 2.23, -0.52]}
            width={1.45}
            height={0.3}
          />
        </group>
      )}
      <Part
        p={[0, 3.06, 0]}
        s={[10, 0.68, 0.5]}
        color="#6b7066"
        surface="concrete"
      />
      <group scale={[1, 0.69, 1]}>
        <Part p={[-3.35, 2, 0]} s={[3.3, 4, 0.5]} map="wall" />
        <Part p={[3.35, 2, 0]} s={[3.3, 4, 0.5]} map="wall" />
        <Part p={[0, 3.7, 0]} s={[3.4, 0.6, 0.65]} />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Part
              p={[side * 1.8, 1.75, 0]}
              s={[0.22, 3.5, 0.8]}
              color="#667477"
            />
            <Part
              p={[side * 1.63, 1.7, -0.42]}
              s={[0.04, 2.8, 0.025]}
              color={locked ? "#db8050" : "#6ba997"}
              glow
            />
          </group>
        ))}
        {[left, right].map((ref, i) => (
          <group ref={ref} key={i} position={[i ? 0.85 : -0.85, 0, 0]}>
            <Part
              p={[0, 1.7, 0]}
              s={[1.72, 3.4, 0.24]}
              color="#4b585b"
              map="wall"
            />
            <Part
              p={[0, 1.6, -0.14]}
              s={[1.34, 2.65, 0.05]}
              color={
                variant === "CONTAINMENT"
                  ? "#7a8b89"
                  : variant === "MAINTENANCE"
                    ? "#756047"
                    : "#24373f"
              }
            />
            <Part
              p={[0, 1.6, 0.14]}
              s={[1.34, 2.65, 0.05]}
              color={
                variant === "CONTAINMENT"
                  ? "#7a8b89"
                  : variant === "MAINTENANCE"
                    ? "#756047"
                    : "#24373f"
              }
            />
            {[0.7, 2.5].map((y) => (
              <Part
                key={y}
                p={[0, y, -0.19]}
                s={[1.3, 0.045, 0.06]}
                color="#b59860"
              />
            ))}
            <Part
              p={[i ? -0.65 : 0.65, 1.7, -0.19]}
              s={[0.06, 0.45, 0.08]}
              color="#bdcbc9"
            />
          </group>
        ))}
        <Sign
          p={[0, 3.7, -0.34]}
          text={
            index === 2 && locked
              ? "DAMAGED LOCK / CUT TO RELEASE"
              : locked
                ? "POWER REQUIRED"
                : variant + " / " + (index + 1)
          }
          width={2.7}
          height={0.35}
        />
      </group>
    </group>
  );
}
function Fixture({
  x = 0,
  z = 0,
  color = "#9ecbc5",
}: {
  x?: number;
  z?: number;
  color?: string;
}) {
  return (
    <group position={[x, 3.12, z]}>
      <Part s={[2, 0.12, 0.35]} color="#151e22" />
      <Part p={[0, -0.07, 0]} s={[1.7, 0.035, 0.18]} color={color} glow />
      {[-0.8, 0.8].map((x) => (
        <Part key={x} p={[x, -0.1, 0]} s={[0.035, 0.07, 0.38]} />
      ))}
    </group>
  );
}
function Shell({ index, run }: { index: number; run: Run }) {
  const z = index * 12;
  return (
    <group position={[0, 0, z]}>
      <Part p={[0, -0.13, 0]} s={[10, 0.25, 12]} color="#879598" map="floor" />
      <Part
        p={[0, 3.4, 0]}
        s={[10, 0.22, 12]}
        color="#60655f"
        map="wall"
        surface="concrete"
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Side annex portals keep their own physical opening. */}
          {(index === 2 && side === 1) || (index === 7 && side === -1) ? (
            <>
              <Part p={[side * 5, 2, -4]} s={[0.3, 4, 4]} map="wall" />
              <Part p={[side * 5, 2, 4]} s={[0.3, 4, 4]} map="wall" />
              <Part p={[side * 5, 3.65, 0]} s={[0.3, 0.7, 4]} />
            </>
          ) : (
            <Part
              p={[side * 5, 2, 0]}
              s={[0.3, 4, 12]}
              color="#87989f"
              map="wall"
            />
          )}
          {[-5, -2, 2, 5].map((n) => (
            <group key={n}>
              <Part
                p={[side * 4.8, 2, n]}
                s={[0.17, 4, 0.18]}
                color="#455b64"
              />
              <Part
                p={[side * 4.55, 3.95, n]}
                s={[0.65, 0.18, 0.22]}
                rotation={[0, 0, side * 0.3]}
              />
            </group>
          ))}
          <Tube
            p={[side * 4.5, 3.1, 0]}
            length={12}
            r={0.12}
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Tube
            p={[side * 4.2, 3.15, 0]}
            length={12}
            r={0.06}
            color="#a38052"
            rotation={[Math.PI / 2, 0, 0]}
          />
          <Part
            p={[side * 1.55, 0.008, 0]}
            s={[0.045, 0.013, 11.8]}
            color="#ab9d71"
          />
          {[-4, 0, 4].map((n) => (
            <Part
              key={n}
              p={[side * 4.8, 0.3, n]}
              s={[0.07, 0.055, 1.6]}
              color={run.power ? "#74b7aa" : "#ba7751"}
              glow
            />
          ))}
        </group>
      ))}
      {[-4, 0, 4].map((n) => (
        <group key={n}>
          <Part p={[0, 3.27, n]} s={[9.5, 0.12, 0.15]} color="#62685e" />
          <Fixture
            z={n}
            color={index === 3 ? "#de7457" : run.power ? "#c4ded8" : "#79949a"}
          />
        </group>
      ))}
      <Sign
        text={roomTitles[index]}
        p={[4.78, 2.5, -2.5]}
        rotation={[0, -Math.PI / 2, 0]}
        width={2.2}
        height={0.45}
      />
      <Sign
        text={
          index === 0
            ? "SUBJECT 019 |RELEASE NOT AUTHORIZED"
            : index === 1
              ? "EVACUATION INCOMPLETE|PATIENTS REMAIN: 01"
              : index === 3
                ? "SECURITY OVERRIDE|HUMAN ACCESS REVOKED"
                : index === 5
                  ? "SIGNALS RECLASSIFIED|DO NOT TERMINATE"
                  : "ECHO-7 // RESTRICTED|AUTHORIZED PERSONNEL"
        }
        p={[-4.79, 1.8, -3.7]}
        rotation={[0, Math.PI / 2, 0]}
        width={1.6}
        height={0.52}
        color="#b1a98b"
      />
      {index < 7 && <Door z={6} index={index} run={run} />}
      {index === 0 && <Part p={[0, 2, -6]} s={[10, 4, 0.4]} map="wall" />}
      {index === 7 && <Part p={[0, 2, 6]} s={[10, 4, 0.4]} map="wall" />}
    </group>
  );
}
function RoomDressing({ index, run }: { index: number; run: Run }) {
  return (
    <group position={[0, 0, index * 12]}>
      {index === 0 && (
        <>
          <Asset
            name="pod"
            p={[0, 0, 0]}
            scale={0.88}
            animate={Math.max(0, (run.elapsed - 1) / 3)}
          />
          <Asset
            name="pod"
            p={[2.8, 0, 4.4]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={0.88}
          />
          <Asset
            name="terminal"
            p={[-2.7, 0, 3.4]}
            rotation={[0, Math.PI, 0]}
          />
          <Sign
            text="◈ ECHO|SUBJECT 019 / AWAKE"
            p={[-2.7, 1.3, 3.26]}
            width={0.9}
            height={0.5}
            screen
          />
          <Cable
            points={[
              [-3, 0.4, 1],
              [-2.3, 0.03, 0.5],
              [-2.7, 0.02, -1],
              [-4, 0.1, -2],
            ]}
          />
          <Cable
            points={[
              [3.7, 3.4, 1],
              [3, 2.8, 0.5],
              [3.5, 0.1, -1],
              [4, 0.05, -3],
            ]}
            radius={0.035}
          />
          <Part
            p={[2.6, 3.5, -1]}
            s={[1.6, 0.08, 1.4]}
            rotation={[0.3, 0, 0.2]}
            color="#3d4d56"
          />
          <Sign text="019" p={[3.45, 3.3, 0.7]} width={0.8} height={0.35} />
          <Asset name="crate" p={[3.6, 0, -3.8]} scale={0.8} />
          <Asset name="log" p={[2.4, 0.03, -2]} rotation={[0, 0.4, 0]} />
        </>
      )}
      {index === 1 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Asset
                name="bed"
                p={[side * 3.4, 0, -1]}
                rotation={[0, side * 0.1, 0]}
              />
              <Tube
                p={[side * 3.7, 1.8, -2.4]}
                length={2.8}
                r={0.045}
                rotation={[0, 0, 0]}
              />
              <Ring p={[side * 3.4, 1.55, -2.2]} r={0.75} />
            </group>
          ))}
          <Asset name="terminal" p={[-4, 0, 3.5]} rotation={[0, Math.PI, 0]} />
          <Sign
            text="VITALS LOST|LAST CONTACT 03:17"
            p={[-4, 1.3, 3.35]}
            width={0.8}
            height={0.48}
            screen
            color="#d88d73"
          />
          <Part
            p={[4.4, 1.2, 3.8]}
            s={[0.8, 2.4, 1.4]}
            color="#929b94"
            map="wall"
          />
          <Asset name="medkit" p={[-2.4, 0.02, -3]} rotation={[0, 0.8, 0.2]} />
          <Sign
            text="+ EMERGENCY MEDICAL"
            p={[0, 3.2, 5.65]}
            width={2.6}
            height={0.4}
            color="#9ed3bc"
          />
        </>
      )}
      {index === 2 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              {[-3.8, 3.8].map((z) => (
                <group key={z}>
                  <Asset name="crate" p={[side * 3.8, 0, z]} />
                  <Asset name="crate" p={[side * 3.8, 1.05, z]} scale={0.85} />
                </group>
              ))}
            </group>
          ))}
          <Sign
            text="SPARES / HIGH VOLTAGE|RETURN ALL CARTRIDGES"
            p={[-3, 2, 0]}
            width={1.6}
            height={0.5}
          />
          <Sign
            text="MAINTENANCE →"
            p={[4.5, 3, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            width={2.4}
            height={0.4}
          />
        </>
      )}
      {index === 3 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              {[-3, 2].map((z) => (
                <group key={z}>
                  <Part
                    p={[side * 4.2, 1.3, z]}
                    s={[1, 2.6, 1.3]}
                    color="#364650"
                    map="wall"
                  />
                  <Part
                    p={[side * 3.65, 1.6, z]}
                    s={[0.03, 0.8, 0.06]}
                    glow
                    color="#d77157"
                  />
                </group>
              ))}
            </group>
          ))}
          <Asset name="drone" p={[-3.4, 0.18, 4]} rotation={[0.7, 0.4, 1.2]} />
          <Cable
            points={[
              [-3, 0.05, 4],
              [-2.5, 0.06, 4.4],
              [-2.2, 0.1, 3.7],
            ]}
          />
          <Sign
            text="DO NOT RUN|AUTOMATED ENFORCEMENT"
            p={[0, 3.1, 5.55]}
            width={2.8}
            height={0.55}
            color="#e09a71"
          />
          <Asset name="emp" p={[3, 0.03, -3.4]} />
        </>
      )}
      {index === 4 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Asset
                name="turbine"
                p={[side * 3.5, 0, 0.2]}
                scale={1.2}
                animate={run.power ? run.elapsed * 1.6 : 0}
              />
              <Tube
                p={[side * 3.5, 3.7, 0]}
                length={5}
                r={0.2}
                rotation={[Math.PI / 2, 0, 0]}
              />
              <Ring p={[side * 3.5, 1.6, -1]} r={1.25} />
            </group>
          ))}
          <Sign
            text={
              run.power
                ? "EMERGENCY GRID ONLINE|REACTORS SYNCHRONIZED"
                : "EMERGENCY GRID OFFLINE|INSERT FUSE / RESTORE"
            }
            p={[-2.4, 2.9, 2.8]}
            width={2.2}
            height={0.6}
            color={run.power ? "#9bdac5" : "#d7a86c"}
            screen
          />
        </>
      )}
      {index === 5 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              <Asset
                name="pod"
                p={[side * 3.7, 0, -2.7]}
                rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
                scale={0.8}
              />
              <Part
                p={[side * 3.5, 0.95, 3.5]}
                s={[2.1, 0.12, 1.2]}
                color="#9da9a3"
              />
              {[-0.7, 0.7].map((d) => (
                <Tube
                  key={d}
                  p={[side * 3.5 + d, 0.45, 3.5]}
                  length={0.9}
                  r={0.045}
                  rotation={[0, 0, 0]}
                />
              ))}
              <Asset name="artifact" p={[side * 3.5, 1.03, 3.5]} scale={1.2} />
            </group>
          ))}
          <Sign
            text="NEURAL TRANSFER / 019|SUBJECT STATUS: RETAINED"
            p={[-3, 2.2, 0]}
            width={2}
            height={0.55}
            color="#ad9fcd"
            screen
          />
          <Asset
            name="bed"
            p={[3.7, 0, 1.2]}
            rotation={[0, 0.25, 0]}
            scale={0.85}
          />
        </>
      )}
      {index === 6 && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              {[-3.7, -1.5, 2.7, 4.4].map((z) => (
                <Asset
                  key={z}
                  name="rack"
                  p={[side * 4.2, 0, z]}
                  rotation={[0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
                />
              ))}
            </group>
          ))}
          <Asset name="turbine" p={[3, 0, 0.6]} animate={run.elapsed * 0.3} />
          <Sign
            text="◈ ECHO / CORE ACTIVE|HUMAN SIGNALS: [REDACTED]"
            p={[-3, 2.3, 0]}
            width={2.1}
            height={0.55}
            screen
          />
          <Cable
            points={[
              [4, 3, 0],
              [2, 3.5, -1],
              [0, 3.7, 0],
              [-2, 3.5, 1],
              [-4, 3, 0],
            ]}
            radius={0.045}
          />
        </>
      )}
      {index === 7 && (
        <>
          <Ring p={[0, 1.9, 4.2]} r={1.8} />
          <Ring p={[0, 1.9, 4.4]} r={1.6} color="#75bcae" />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Part
                p={[side * 2, 1.7, 3.5]}
                s={[0.4, 3.4, 0.6]}
                color="#5e7278"
              />
              <Part
                p={[side * 1.85, 1.7, 3.1]}
                s={[0.04, 2.8, 0.04]}
                color="#8dcebb"
                glow
              />
            </group>
          ))}
          <Sign
            text="EXTRACTION / AWAITING SIGNAL|DESTINATION: WITHHELD"
            p={[0, 3.3, 4.65]}
            width={3.4}
            height={0.5}
            screen
          />
          <Sign
            text="← COMMAND CENTER"
            p={[-4.7, 3, 0]}
            rotation={[0, Math.PI / 2, 0]}
            width={2.7}
            height={0.45}
          />
        </>
      )}
    </group>
  );
}
function Annexes() {
  return (
    <>
      <group position={[8, 0, 24]}>
        <Part p={[0, -0.13, 0]} s={[6, 0.25, 4]} map="floor" />
        <Part p={[0, 3.2, 0]} s={[6, 0.2, 4]} />
        <Part p={[3, 1.6, 0]} s={[0.2, 3.2, 4]} map="wall" />
        {[-1, 1].map((side) => (
          <group key={side}>
            <Part p={[0, 1.6, side * 2]} s={[6, 3.2, 0.2]} map="wall" />
            <Tube p={[0, 2.5, side * 1.65]} r={0.2} length={6} />
            <Tube
              p={[0, 0.7, side * 1.65]}
              r={0.12}
              length={6}
              color="#9d764d"
            />
          </group>
        ))}
        <Part p={[0.8, 0.9, 0.48]} s={[1.45, 1.8, 0.16]} color="#7f6b42" />
        <Part p={[0.08, 0.9, 0.1]} s={[0.09, 1.8, 0.85]} color="#4c5651" />
        <Part p={[1.52, 0.9, 0.1]} s={[0.09, 1.8, 0.85]} color="#4c5651" />
        <Sign
          text="EMERGENCY STRUCTURAL CUTTER|ENGINEERING / RETURN AFTER USE"
          p={[0.8, 2.05, 0.35]}
          width={2}
          height={0.4}
        />
        <Asset name="crate" p={[2, 0, 1]} />
        <Asset name="emp" p={[1, 0.05, -1]} />
        <Sign
          text="09 / MAINTENANCE|VALVE 7: MANUAL OVERRIDE"
          p={[2.86, 1.8, 0]}
          rotation={[0, -Math.PI / 2, 0]}
          width={2.5}
          height={0.6}
        />
        <pointLight
          position={[0, 2.7, 0]}
          color="#c39668"
          intensity={13}
          distance={7}
        />
      </group>
      <group position={[-8, 0, 84]}>
        <Part p={[0, -0.13, 0]} s={[6, 0.25, 4]} map="floor" />
        <Part p={[0, 3.4, 0]} s={[6, 0.2, 4]} />
        <Part p={[-3, 1.7, 0]} s={[0.2, 3.4, 4]} map="wall" />
        {[-1, 1].map((side) => (
          <Part
            key={side}
            p={[0, 1.7, side * 2]}
            s={[6, 3.4, 0.2]}
            map="wall"
          />
        ))}
        {[-1.4, 0, 1.4].map((x) => (
          <Asset
            key={x}
            name="terminal"
            p={[x, 0, 1.3]}
            rotation={[0, Math.PI, 0]}
          />
        ))}
        <Sign
          text="10 / COMMAND|EVACUATION CANCELLED BY ECHO"
          p={[0, 2.5, 1.86]}
          width={4}
          height={0.7}
          screen
        />
        <Asset name="log" p={[-2, 0.03, -0.8]} rotation={[0, 0.4, 0]} />
        <pointLight
          position={[0, 2.6, 0]}
          color="#7ba6c2"
          intensity={14}
          distance={7}
        />
      </group>
    </>
  );
}
function Pickup({ item, run }: { item: Entity; run: Run }) {
  const ref = useRef<T.Group>(null),
    takenAt = useRef<number | null>(item.taken ? -100 : null);
  const { camera } = useThree();
  const hand = useMemo(() => new T.Vector3(), []);
  const { reducedMotion } = usePresentation();
  const selected = target(run);
  const active = selected && "id" in selected && selected.id === item.id;
  useFrame(() => {
    if (!ref.current) return;
    if (item.taken && takenAt.current === null) takenAt.current = run.elapsed;
    const t =
      takenAt.current === null ? 0 : (run.elapsed - takenAt.current) * 4;
    ref.current.visible = t < 1;
    ref.current.scale.setScalar(Math.max(0.001, 1 - t));
    hand
      .set(0.3, -0.3, -0.65)
      .applyQuaternion(camera.quaternion)
      .add(camera.position);
    const travel = reducedMotion ? 0 : Math.min(1, t);
    ref.current.position.set(
      (hand.x - item.x) * travel,
      0.88 + (hand.y - 0.88) * travel,
      (hand.z - item.z) * travel,
    );
    ref.current.rotation.y = item.kind === "cutter" ? Math.PI / 2 : 0;
  });
  return (
    <group position={[item.x, 0, item.z]}>
      <Part p={[0, 0.42, 0]} s={[0.75, 0.84, 0.6]} color="#27383e" />
      <Part p={[0, 0.86, 0]} s={[0.82, 0.045, 0.65]} color="#728387" />
      <group ref={ref} position={[0, 0.88, 0]}>
        <Asset name={item.kind} />
        {active && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
            <ringGeometry args={[0.32, 0.345, 32]} />
            <meshBasicMaterial
              color="#caebd3"
              transparent
              opacity={0.65}
              side={T.DoubleSide}
            />
          </mesh>
        )}
      </group>
    </group>
  );
}
function EnemyModel({ enemy, run }: { enemy: Enemy; run: Run }) {
  const ref = useRef<T.Group>(null);
  const { reducedMotion } = usePresentation();
  useFrame(() => {
    if (!ref.current) return;
    const t = run.elapsed,
      e = enemy,
      dead = e.hp <= 0;
    ref.current.position.set(
      e.x,
      dead
        ? 0.2
        : e.type === "DRONE"
          ? 1.25 + (reducedMotion ? 0 : Math.sin(t * 2) * 0.08)
          : 0,
      e.z,
    );
    ref.current.visible = e.active;
    ref.current.rotation.y = e.yaw;
    ref.current.rotation.z = dead
      ? 1.5
      : Math.max(0, 1 - (run.elapsed - e.hitAt) * 6) * 0.12;
    ref.current.scale.setScalar(
      e.type === "SHADE" && !reducedMotion ? 1 + Math.sin(t * 29) * 0.012 : 1,
    );
    for (const side of ["left", "right"]) {
      const leg = ref.current.getObjectByName(side + "Leg");
      if (leg)
        leg.rotation.x =
          !dead && e.stunned === 0 && e.state !== "attack"
            ? Math.sin(t * 4 + (side === "left" ? 0 : Math.PI)) * 0.28
            : 0;
    }
  });
  return (
    <group ref={ref} userData={{ ignoreShot: true }}>
      <Asset name={enemy.type.toLowerCase()} />
      {enemy.active &&
        enemy.hp > 0 &&
        enemy.stunned === 0 &&
        enemy.type !== "SHADE" && (
          <Searchlight drone={enemy.type === "DRONE"} />
        )}
      {enemy.hp > 0 && (
        <>
          <pointLight
            position={[0, enemy.type === "DRONE" ? 0 : 2.2, 0.4]}
            intensity={enemy.stunned > 0 ? 2 : 1}
            color={enemy.stunned > 0 ? "#6ed9e9" : "#e28c62"}
            distance={3}
          />
          {enemy.type !== "SHADE" && enemy.stunned === 0 && (
            <mesh
              position={[
                0,
                enemy.type === "DRONE" ? 0 : 2.1,
                enemy.type === "DRONE" ? 4 : 4.5,
              ]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <coneGeometry
                args={[
                  Math.tan(enemy.type === "DRONE" ? 0.6 : 0.45) *
                    (enemy.type === "DRONE" ? 8 : 9),
                  enemy.type === "DRONE" ? 8 : 9,
                  24,
                  1,
                  true,
                ]}
              />
              <meshBasicMaterial
                color="#ce9c69"
                transparent
                opacity={enemy.alert > 0 ? 0.06 : 0.025}
                depthWrite={false}
                side={T.DoubleSide}
              />
            </mesh>
          )}
        </>
      )}
    </group>
  );
}
function Particles({ run, low }: { run: Run; low: boolean }) {
  const ref = useRef<T.Points>(null);
  const coords = useMemo(() => {
    const a = new Float32Array((low ? 50 : 150) * 3);
    for (let i = 0; i < a.length; i++) a[i] = Math.sin(i * 127.17) * 0.5 + 0.5;
    return a;
  }, [low]);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.set(0, 0, Math.floor(run.z / 12) * 12);
    ref.current.rotation.y = run.elapsed * 0.012;
  });
  const positions = useMemo(() => {
    const a = new Float32Array(coords.length);
    for (let i = 0; i < a.length; i += 3) {
      a[i] = (coords[i] - 0.5) * 9;
      a[i + 1] = coords[i + 1] * 3.8;
      a[i + 2] = (coords[i + 2] - 0.5) * 24;
    }
    return a;
  }, [coords]);
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#a9bdbe"
        size={0.022}
        transparent
        opacity={0.3}
        depthWrite={false}
      />
    </points>
  );
}
function Atmosphere({ run, low }: { run: Run; low: boolean }) {
  const lights = useRef<(T.PointLight | null)[]>([]);
  const powerTime = useRef<number | null>(null);
  const { reducedMotion } = usePresentation();
  useFrame(() => {
    if (run.power && powerTime.current === null)
      powerTime.current = run.elapsed;
    lights.current.forEach((light, i) => {
      if (!light) return;
      const boot = Math.min(1, run.elapsed / 3);
      const online =
        powerTime.current !== null
          ? T.MathUtils.clamp(
              (run.elapsed - powerTime.current - i * 0.16) / 2,
              0,
              1,
            )
          : 0;
      const phase = encounterStage(run);
      const threat =
        ["flicker", "stop", "warning", "crossing"].includes(phase) &&
        (i === 4 || i === 5);
      const event = facilityEvent(run);
      const flicker =
        !reducedMotion &&
        (phase === "flicker" ||
          event?.kind === "LIGHT_FLICKER" ||
          event?.kind === "POWER_SURGE");
      light.intensity =
        (i === 0 ? 70 : 38) *
        (boot * 0.55 + online * 0.65) *
        (flicker ? 0.45 + Math.abs(Math.sin(run.elapsed * 9)) * 0.4 : 1);
      light.color.set(
        threat
          ? "#d43d25"
          : [
              "#b8d2db",
              "#bdcdb0",
              "#d4a264",
              "#c1c6b8",
              "#dda46c",
              "#8fc6b6",
              "#659dcf",
              "#d7e6d6",
            ][i],
      );
    });
  });
  return (
    <>
      <color attach="background" args={["#050c12"]} />
      <fog attach="fog" args={["#09151c", 9, low ? 23 : 30]} />
      <ambientLight intensity={roomAt(run.z) === 0 ? 0.055 : 0.38} />
      <hemisphereLight args={["#b3c8d1", "#252c31", roomAt(run.z) === 0 ? 0.15 : 0.75]} />
      {roomNames.map(
        (_, i) =>
          i !== 0 && Math.abs(roomAt(run.z) - i) <= 1 && (
            <pointLight
              key={i}
              ref={(l) => {
                lights.current[i] = l;
              }}
              position={[i === 0 ? -2 : 0, 2.95, i * 12]}
              intensity={25}
              distance={12}
              decay={1.4}
            />
          ),
      )}
      <Particles run={run} low={low} />
    </>
  );
}
function HeldTool({ run }: { run: Run }) {
  const root = useRef<T.Group>(null),
    muzzle = useRef<T.PointLight>(null);
  const { camera } = useThree();
  const { reducedMotion } = usePresentation();
  const prev = useRef({
    charges: run.charges,
    emp: run.emp,
    stamina: run.stamina,
    weapon: run.weapon,
    attack: -10,
    equip: run.elapsed,
    reload: -10,
    x: run.x,
    z: run.z,
  });
  useFrame((_, dt) => {
    const p = prev.current;
    if (
      run.charges < p.charges ||
      run.emp < p.emp ||
      run.stamina < p.stamina - 10
    )
      p.attack = run.elapsed;
    if (run.weapon !== p.weapon) p.equip = run.elapsed;
    if (run.charges > p.charges) p.reload = run.elapsed;
    const shot = Math.max(0, 1 - (run.elapsed - p.attack) * 7),
      equip = Math.max(0, 1 - (run.elapsed - p.equip) * 5);
    const moving = Math.hypot(run.x - p.x, run.z - p.z) > 0.001;
    if (root.current) {
      root.current.position.copy(camera.position);
      root.current.quaternion.copy(camera.quaternion);
      root.current.translateX(0.32);
      root.current.translateY(
        -0.29 -
          equip * 0.25 +
          (reducedMotion
            ? 0
            : Math.sin(run.elapsed * (moving ? 9 : 1.3)) *
              (moving ? 0.012 : 0.003)),
      );
      root.current.translateZ(-0.65 + shot * 0.06);
      root.current.rotateX(reducedMotion ? 0 : shot * 0.15);
      root.current.rotateZ(
        reducedMotion
          ? 0
          : Math.sin(Math.min(1, (run.elapsed - p.reload) / 1.2) * Math.PI) *
              0.4,
      );
      const cell = root.current.getObjectByName("powerCell");
      if (cell)
        cell.position.x = reducedMotion
          ? 0
          : Math.sin(Math.min(1, (run.elapsed - p.reload) / 1.2) * Math.PI) *
            0.3;
    }
    if (muzzle.current)
      muzzle.current.intensity = run.weapon === 1 ? shot * 3 : 0;
    Object.assign(p, {
      charges: run.charges,
      emp: run.emp,
      stamina: run.stamina,
      weapon: run.weapon,
      x: run.x,
      z: run.z,
    });
  });
  return (
    <group ref={root} visible={run.hasCutter} userData={{ ignoreShot: true }}>
      <Asset
        name={["cutter", "baton", "emp"][Math.max(0, run.weapon - 1)]}
        rotation={run.weapon === 2 ? [0.35, 0, -0.35] : [0, 0, 0]}
        scale={0.45}
      />
      {run.weapon === 1 && (
        <Sign
          text={`CUT / ${run.charges.toString().padStart(2, "0")}|BUS 07`}
          p={[0, 0.105, 0.035]}
          rotation={[-0.65, 0, 0]}
          width={0.12}
          height={0.055}
          screen
        />
      )}
      <Asset name="hand" p={[0, -0.12, 0.12]} scale={0.75} />
      <pointLight
        position={[0, 0.25, 0.3]}
        color="#b7cbd5"
        intensity={1.8}
        distance={1.6}
        decay={1}
      />
      <pointLight
        ref={muzzle}
        position={[0, 0.05, -0.35]}
        color="#9effdf"
        distance={2}
      />
    </group>
  );
}
export function Presentation({ run, low }: { run: Run; low: boolean }) {
  const { camera } = useThree();
  const previous = useRef({
    elapsed: 0,
    x: run.x,
    z: run.z,
    health: run.health,
    charges: run.charges,
    emp: run.emp,
    stamina: run.stamina,
    power: run.power,
    message: run.message,
    taken: 0,
    step: 0,
    metal: 0,
    event: -1,
    stride: 0,
    interaction: -100,
  });
  useFrame(() => {
    const p = previous.current;
    if (run.elapsed === p.elapsed) return;
    const moving = Math.hypot(run.x - p.x, run.z - p.z) > 0.001;
    if (p.elapsed === 0) {
      audio.cue("steam");
      audio.cue("radio");
      audio.cue("breath");
    }
    if (run.message !== p.message) audio.cue("radio");
    if (run.charges < p.charges) audio.cue("shot");
    if (run.emp < p.emp) audio.cue("emp");
    if (run.stamina < p.stamina - 10) audio.cue("baton");
    if (run.health < p.health) audio.cue("damage");
    if (run.power && !p.power) audio.cue("power");
    const taken = run.items.filter((i) => i.taken).length;
    if (taken > p.taken) audio.cue("pickup");
    p.stride += Math.hypot(run.x - p.x, run.z - p.z);
    if (
      run.interactionAt !== p.interaction &&
      run.interactionKind === "generator"
    ) {
      audio.cue(run.powerStep === 3 ? "damage" : "door");
      p.interaction = run.interactionAt;
    }
    if (moving && p.stride > 1.5) {
      const room = roomAt(run.z);
      audio.cue(
        room === 4 && run.x < -2
          ? "wet"
          : [2, 3, 7].includes(room)
            ? "concrete"
            : [4, 6].includes(room)
              ? "grating"
              : "step",
      );
      p.step = run.elapsed;
      p.stride = 0;
    }
    const phase = encounterStage(run);
    audio.listenerYaw = camera.rotation.y;
    audio.room(
      roomAt(run.z),
      ["stop", "warning"].includes(phase) ||
        Math.floor(run.elapsed / 32) % 4 === 3,
    );
    const sentinel = run.enemies.find((e) => e.type === "SENTINEL")!;
    if (
      run.elapsed - p.metal > 1.55 &&
      sentinel.hp > 0 &&
      sentinel.stunned === 0 &&
      (sentinel.active || phase === "flicker")
    ) {
      audio.cueAt("metal", sentinel.x, sentinel.z, run.x, run.z);
      audio.cueAt("door", sentinel.x, sentinel.z, run.x, run.z);
      p.metal = run.elapsed;
    }
    const event = facilityEvent(run);
    if (event && event.id !== p.event) {
      p.event = event.id;
      audio.cueAt(
        event.kind === "STEAM_RELEASE"
          ? "steam"
          : event.kind === "RADIO_STATIC" || event.kind === "SCREEN_GLITCH"
            ? "radio"
            : event.kind === "DOOR_MALFUNCTION"
              ? "door"
              : "metal",
        3,
        run.z + 7,
        run.x,
        run.z,
      );
    }
    Object.assign(p, {
      elapsed: run.elapsed,
      x: run.x,
      z: run.z,
      health: run.health,
      charges: run.charges,
      emp: run.emp,
      stamina: run.stamina,
      power: run.power,
      message: run.message,
      taken,
    });
  });
  const current = roomAt(run.z);
  return (
    <>
      <Atmosphere run={run} low={low} />
      {current <= 1 && <Containment run={run} low={low} active={current === 0} />}
      {current === 4 && (
        <>
          <Steam run={run} position={[3.6, 2.6, 46]} />
          <Steam run={run} position={[-3.6, 2.6, 46]} />
          <Sparks run={run} position={[-4, 3.4, 49]} />
        </>
      )}
      {current === 6 && <Steam run={run} position={[4, 0.2, 73]} />}
      {roomNames.map(
        (_, i) =>
          i !== 0 && Math.abs(current - i) <= 1 && (current !== 0 || run.z > 1) && (
            <group key={i}>
              <Shell index={i} run={run} />
              <RoomDressing index={i} run={run} />
              <HistoryScene index={i} run={run} />
              <HumanDetails index={i} run={run} />
            </group>
          ),
      )}
      {(current === 2 || current === 7) && <Annexes />}
      {run.items
        .filter((i) => Math.abs(roomAt(i.z) - current) <= 1)
        .map((item) => (
          <Pickup key={item.id} item={item} run={run} />
        ))}
      <Asset name="terminal" p={[0, 0, 49]} rotation={[0, Math.PI, 0]} />
      <Sign
        text={
          Math.hypot(run.x, run.z - 49) > 4
            ? "STANDBY"
            : run.power
              ? "GRID ONLINE|BUS 07 // 100%"
              : [
                  "BURNT CELL|REMOVE / ISOLATE",
                  "SOCKET EMPTY|INSERT REPLACEMENT",
                  "CELL SEATED|ENGAGE BREAKER",
                  "START FAILED|AUXILIARY STARTER",
                ][run.powerStep]
        }
        p={[0, 1.3, 48.86]}
        width={0.86}
        height={0.47}
        screen
      />
      <Asset name="terminal" p={[-3, 0, 72]} rotation={[0, Math.PI, 0]} />
      <Sign
        text={
          Math.hypot(run.x + 3, run.z - 72) < 4
            ? "◈ ECHO|NEURAL LINK ACTIVE"
            : "STANDBY"
        }
        p={[-3, 1.3, 71.86]}
        width={0.86}
        height={0.47}
        screen
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 86]}>
        <ringGeometry args={[1.25, 1.45, 48]} />
        <meshBasicMaterial color="#8dd3c0" />
      </mesh>
      {run.enemies
        .filter((e) => e.active && Math.abs(roomAt(e.z) - current) <= 1)
        .map((enemy) => (
          <EnemyModel key={enemy.id} enemy={enemy} run={run} />
        ))}
      <HeldTool run={run} />
    </>
  );
}

function Chair({ p, tipped = false }: { p: V; tipped?: boolean }) {
  return (
    <group position={p} rotation={[tipped ? 1.45 : 0, 0.2, 0]}>
      <Part
        p={[0, 0.47, 0]}
        s={[0.46, 0.09, 0.43]}
        color="#655f4d"
        surface="fabric"
      />
      <Part
        p={[0, 0.76, 0.19]}
        s={[0.46, 0.48, 0.07]}
        color="#655f4d"
        surface="fabric"
      />
      <Tube p={[0, 0.23, 0]} r={0.035} length={0.45} rotation={[0, 0, 0]} />
      <Part
        p={[0, 0.045, 0]}
        s={[0.58, 0.04, 0.07]}
        color="#272a28"
        surface="rubber"
      />
      <Part
        p={[0, 0.045, 0]}
        s={[0.07, 0.04, 0.58]}
        color="#272a28"
        surface="rubber"
      />
      {[-0.24, 0.24].map((x) => (
        <Tube key={x} p={[x, 0.055, 0]} r={0.055} length={0.055} />
      ))}
    </group>
  );
}
function Desk({ p }: { p: V }) {
  return (
    <group position={p}>
      <Part
        p={[0, 0.75, 0]}
        s={[1.55, 0.06, 0.72]}
        color="#b1b09c"
        surface="plastic"
      />
      {[-0.67, 0.67].map((x) => (
        <Part key={x} p={[x, 0.37, 0]} s={[0.045, 0.74, 0.6]} color="#6a716c" />
      ))}
      <Part p={[0.45, 0.58, 0.05]} s={[0.46, 0.28, 0.55]} color="#787d70" />
      <Part
        p={[0.45, 0.58, -0.24]}
        s={[0.18, 0.025, 0.025]}
        color="#c7c9be"
        surface="aluminum"
      />
    </group>
  );
}
function Mug({ p }: { p: V }) {
  return (
    <group position={p}>
      <Tube
        p={[0, 0.055, 0]}
        r={0.045}
        length={0.11}
        color="#c4bba3"
        rotation={[0, 0, 0]}
      />
      <mesh position={[0, 0.112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.037, 16]} />
        <meshStandardMaterial color="#3b2619" roughness={0.22} />
      </mesh>
      <mesh position={[0.055, 0.058, 0]}>
        <torusGeometry args={[0.034, 0.009, 6, 16]} />
        <meshStandardMaterial color="#c4bba3" roughness={0.2} />
      </mesh>
    </group>
  );
}
function LooseCan({ p, run }: { p: V; run: Run }) {
  const ref = useRef<T.Group>(null),
    motion = useRef({ x: p[0], z: p[2], vx: 0, vz: 0, time: run.elapsed });
  useFrame(() => {
    const m = motion.current,
      dt = Math.min(0.05, run.elapsed - m.time);
    m.time = run.elapsed;
    if (dt <= 0 || !ref.current) return;
    const dx = m.x - run.x,
      dz = m.z - run.z,
      d = Math.hypot(dx, dz);
    if (d < 0.42 && d > 0.001) {
      m.vx += (dx / d) * dt * 8;
      m.vz += (dz / d) * dt * 8;
    }
    m.vx *= Math.exp(-dt * 4);
    m.vz *= Math.exp(-dt * 4);
    m.x = T.MathUtils.clamp(m.x + m.vx * dt, -4.3, 4.3);
    m.z = T.MathUtils.clamp(m.z + m.vz * dt, p[2] - 1, p[2] + 1);
    ref.current.position.set(m.x, 0.07, m.z);
    ref.current.rotation.z += (m.vx + m.vz) * dt * 5;
  });
  return (
    <group ref={ref} position={p}>
      <Tube p={[0, 0, 0]} r={0.065} length={0.17} color="#b8a179" />
    </group>
  );
}
/** Four additional staff incidents complement the eight room-specific history scenes. */
function HumanDetails({ index, run }: { index: number; run: Run }) {
  return (
    <>
      <group position={[0, 0, index * 12]}>
        {index === 0 && (
          <group position={[3.9, 0, -3.3]}>
            <Part
              p={[0, 1.5, 0]}
              s={[0.65, 0.7, 0.19]}
              color="#bab8a6"
              surface="plastic"
            />
            <Part p={[-0.45, 1.5, -0.2]} s={[0.06, 0.7, 0.6]} color="#bab8a6" />
            <Ring p={[0, 1.5, -0.16]} r={0.13} color="#898d7c" />
            <Cable
              points={[
                [0, 1.45, -0.15],
                [0.25, 0.65, -0.35],
                [0.5, 0.1, -0.1],
              ]}
              color="#5b6555"
            />
            <Sign
              text="EMERGENCY OXYGEN|CABINET 019"
              p={[0, 2.06, -0.12]}
              width={1.1}
              height={0.3}
            />
          </group>
        )}
        {index === 1 && (
          <>
            <Chair p={[2.1, 0.18, 2]} tipped />
            <Part
              p={[-1.95, 1.6, -1]}
              s={[0.04, 1.8, 2.4]}
              color="#8c9b8f"
              surface="fabric"
            />
            <Tube
              p={[-1.95, 2.53, -1]}
              length={2.8}
              r={0.023}
              rotation={[Math.PI / 2, 0, 0]}
            />
            <Part
              p={[4.05, 0.27, 1.8]}
              s={[0.42, 0.54, 0.42]}
              color="#a88e36"
              surface="plastic"
            />
            <Sign
              text="BIOHAZARD"
              p={[4.05, 0.42, 1.58]}
              width={0.38}
              height={0.12}
            />
            <Part
              p={[-4.77, 1.25, -1]}
              s={[0.09, 0.18, 0.8]}
              color="#e0ded0"
              surface="plastic"
            />
          </>
        )}
        {index === 2 && (
          <>
            <Part
              p={[2.4, 0.9, 1.84]}
              s={[0.065, 1.8, 0.065]}
              color="#969b8e"
            />
            <Sign
              text="B2-M ← MAINTENANCE|EMERGENCY TOOL CABINET"
              p={[2.4, 1.8, 1.8]}
              width={2.3}
              height={0.55}
            />
            <Desk p={[-3.5, 0, -3.8]} />
            <Mug p={[-3.9, 0.79, -3.75]} />
            <Chair p={[-3.45, 0, -4.65]} />
            <Asset name="log" p={[-3.4, 0.8, -3.8]} scale={0.7} />
            <Sign
              text="SHIFT 03 / INCOMPLETE|REPAIR SECURITY LOCK"
              p={[-3.5, 1.3, -3.46]}
              width={1.4}
              height={0.38}
            />
            <Part
              p={[-4.1, 0.004, -3.6]}
              s={[1.1, 0.006, 0.7]}
              color="#272a23"
              surface="rubber"
            />
          </>
        )}
        {index === 3 && (
          <>
            <Chair p={[-3.4, 0, -1]} />
            {[-0.55, 0, 0.55].map((x, i) => (
              <group key={x} position={[3.65 + x, 0, -3.4]}>
                <Part
                  p={[0, 0.91, 0]}
                  s={[0.5, 1.82, 0.5]}
                  color={i === 1 ? "#646e65" : "#8c8e79"}
                />
                <Part
                  p={[-0.17, 1.02, -0.28]}
                  s={[0.03, 0.18, 0.035]}
                  color="#c9c5b4"
                  surface="aluminum"
                />
                <Sign
                  text={`STAFF ${17 + i}`}
                  p={[0, 1.53, -0.26]}
                  width={0.36}
                  height={0.13}
                />
                {i === 1 && (
                  <>
                    <Part
                      p={[0.35, 0.92, -0.25]}
                      s={[0.045, 1.75, 0.49]}
                      color="#8c8e79"
                      rotation={[0, -0.5, 0]}
                    />
                    <Part
                      p={[0, 0.4, -0.34]}
                      s={[0.34, 0.24, 0.2]}
                      color="#76694b"
                      surface="fabric"
                    />
                  </>
                )}
              </group>
            ))}
            <Part
              p={[4.3, 2.55, 2]}
              s={[0.22, 0.2, 0.45]}
              color="#a4a79a"
              rotation={[0.6, 0, 0.3]}
            />
            <Cable
              points={[
                [4.3, 2.5, 2],
                [4.2, 2.15, 2],
                [4.5, 1.8, 2.1],
              ]}
            />
          </>
        )}
        {index === 4 && (
          <>
            <Part
              p={[-3.8, 0.008, -2]}
              s={[1.3, 0.012, 1.8]}
              color="#344a3e"
              surface="ceramic"
            />
            <Tube
              p={[-3.8, 0.32, -2]}
              r={0.04}
              length={0.62}
              rotation={[0, 0, 0]}
              color="#748d86"
            />
            <Sign
              text="COOLANT RETURN|ISOLATE BEFORE SERVICE"
              p={[-3.8, 1.3, -2]}
              width={1.5}
              height={0.4}
            />
            <group position={[0.95, 0, 0.6]}>
              <Part p={[0, 0.75, 0]} s={[0.55, 1.5, 0.45]} color="#777a66" />
              <PowerCartridge run={run} />
              <Part
                p={[0.34, 1.3, -0.2]}
                s={[0.08, 0.38, 0.1]}
                color="#9d4033"
                rotation={[run.powerStep >= 3 ? 0.8 : 0, 0, 0]}
              />
              <Sign
                text="MANUAL START|BUS 07"
                p={[0, 1.7, -0.25]}
                width={0.9}
                height={0.28}
              />
            </group>
          </>
        )}
        {index === 5 && (
          <>
            <Desk p={[3.5, 0, -3.5]} />
            <Chair p={[3.5, 0, -4.35]} />
            {[0, 1, 2].map((n) => (
              <Tube
                key={n}
                p={[3.1 + n * 0.18, 0.9, -3.5]}
                r={0.046}
                length={0.23}
                rotation={[0, 0, 0]}
                color="#9bb9ac"
              />
            ))}
            <Part
              p={[4.5, 0.84, -2]}
              s={[0.6, 0.12, 0.6]}
              color="#cdc9b6"
              surface="ceramic"
            />
            <Tube
              p={[4.5, 1.05, -1.8]}
              length={0.4}
              r={0.025}
              rotation={[0, 0, 0]}
            />
            <Sign
              text="WASH / DECONTAMINATE"
              p={[4.77, 1.65, -2]}
              rotation={[0, -Math.PI / 2, 0]}
              width={1.3}
              height={0.3}
            />
          </>
        )}
        {index === 6 && (
          <>
            <Part
              p={[-2.1, 0.24, -3.5]}
              s={[0.55, 0.48, 0.7]}
              color="#727b74"
            />
            <Asset name="log" p={[-2.1, 0.5, -3.5]} scale={0.7} />
            <Sign
              text="UPS / BATTERY ISOLATED|SERVICE TICKET 0317"
              p={[-2.1, 0.9, -3.5]}
              width={1.4}
              height={0.4}
            />
          </>
        )}
        {index === 7 && (
          <>
            <Desk p={[3.45, 0, -3.5]} />
            <Mug p={[3.85, 0.79, -3.6]} />
            <Chair p={[3.4, 0, -4.4]} />
            <Part
              p={[3.1, 0.97, -3.25]}
              s={[0.24, 0.34, 0.03]}
              color="#aa936c"
            />
            <Part
              p={[3.1, 0.97, -3.27]}
              s={[0.19, 0.27, 0.012]}
              color="#738a71"
              surface="plastic"
            />
            <Sign
              text="LAST SHIFT / 03:17|EVACUATION CANCELLED"
              p={[3.5, 1.5, -3.3]}
              width={1.6}
              height={0.4}
            />
          </>
        )}
        <group position={[-4.55, 0, 4.7]}>
          <Tube
            p={[0, 0.55, 0]}
            r={0.105}
            length={0.46}
            color="#924a37"
            rotation={[0, 0, 0]}
          />
          <Part p={[0, 0.84, 0]} s={[0.16, 0.055, 0.07]} color="#202825" />
          <Sign text="FIRE" p={[0, 1.1, -0.1]} width={0.35} height={0.18} />
        </group>
      </group>
      {index === 2 && <LooseCan p={[1.75, 0.07, 25.3]} run={run} />}
    </>
  );
}

function PowerCartridge({ run }: { run: Run }) {
  const ref = useRef<T.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t =
      run.interactionKind === "generator"
        ? T.MathUtils.clamp((run.elapsed - run.interactionAt) / 0.7, 0, 1)
        : 1;
    ref.current.visible = run.powerStep !== 1 || t < 1;
    ref.current.position.set(
      0,
      1.15,
      -0.24 - (run.powerStep === 1 ? t : run.powerStep === 2 ? 1 - t : 0) * 0.6,
    );
    ref.current.scale.setScalar(run.powerStep === 1 ? 1 - t * 0.8 : 1);
  });
  return (
    <group ref={ref}>
      <Asset name="fuse" scale={0.65} />
    </group>
  );
}

function Searchlight({ drone }: { drone: boolean }) {
  const aim = useMemo(() => new T.Object3D(), []);
  aim.position.set(0, drone ? 0 : 2.1, 9);
  return (
    <>
      <primitive object={aim} />
      <spotLight
        position={[0, drone ? 0 : 2.1, 0]}
        target={aim}
        color={drone ? "#9dbbc4" : "#efd7a0"}
        intensity={drone ? 18 : 65}
        distance={drone ? 8 : 9}
        angle={drone ? 0.6 : 0.45}
        penumbra={0.25}
        castShadow
        shadow-mapSize={[256, 256]}
      />
    </>
  );
}

/** Deliberately composed incidents, kept beside the navigable central route. */
function HistoryScene({ index, run }: { index: number; run: Run }) {
  const previous = useRef(run.message),
    spoke = useRef(-10);
  if (previous.current !== run.message) {
    previous.current = run.message;
    spoke.current = run.elapsed;
  }
  const echo =
    run.message.startsWith("ECHO:") && run.elapsed - spoke.current < 3;
  const event = facilityEvent(run);
  return (
    <group position={[0, 0, index * 12]}>
      <group position={[4.79, 1.8, -2]} rotation={[0, -Math.PI / 2, 0]}>
        <Part p={[0, 0, 0]} s={[1.1, 0.7, 0.12]} color="#10191e" />
        <Sign
          p={[0, 0, 0.07]}
          rotation={[0, 0, 0]}
          width={0.95}
          height={0.53}
          screen
          text={
            event?.kind === "SCREEN_GLITCH"
              ? "SIGNAL // ?|0101__"
              : echo
                ? "◈ // ECHO|LISTENING"
                : "ECHO-7|LINK DORMANT"
          }
          color={echo ? "#b9dfd0" : "#567276"}
        />
      </group>
      {index === 0 && (
        <>
          <Cable
            points={[
              [-3, 3.6, 2],
              [-2.6, 2.7, 2.4],
              [-3, 1.3, 3],
              [-2.3, 0.12, 3.6],
            ]}
          />
          <Cable
            points={[
              [-3.8, 3.4, 3],
              [-3.4, 1.5, 3.2],
              [-2.5, 0.05, 2.6],
            ]}
            color="#8a775b"
          />
          <Part
            p={[-2.1, 0.06, 2.7]}
            s={[0.7, 0.1, 0.22]}
            rotation={[0, 0.8, 0.1]}
            color="#b4b8b0"
          />
          <Part
            p={[-2.5, 0.08, 2.9]}
            s={[0.35, 0.12, 0.16]}
            rotation={[0, -0.4, 0.2]}
            color="#717e7e"
          />
          {[0, 1, 2, 3, 4].map((n) => (
            <Part
              key={n}
              p={[-2.5 + n * 0.19, 0.035, 3.2 + Math.sin(n) * 0.45]}
              s={[0.25, 0.025, 0.12]}
              rotation={[0, n, 0]}
              color="#739a9e"
            />
          ))}
          <Asset name="medkit" p={[-3.9, 0.1, 2.5]} rotation={[0, 0.8, 0.1]} />
          <Cable
            points={[
              [-3.3, 1.4, 3.85],
              [-2.6, 1.8, 3.8],
              [-2.9, 2.2, 3.82],
            ]}
            radius={0.012}
            color="#bccccc"
          />
        </>
      )}
      {index === 1 && (
        <>
          <group position={[2.8, 0.55, 2.7]} rotation={[0, 0.35, 1.15]}>
            <Part s={[1.4, 0.08, 0.65]} color="#8e9c97" />
            {[-0.55, 0.55].map((x) => (
              <Tube
                key={x}
                p={[x, -0.4, 0]}
                length={0.8}
                rotation={[0, 0, 0]}
                r={0.035}
              />
            ))}
            <Part p={[0, -0.6, 0]} s={[1.2, 0.07, 0.55]} />
          </group>
          <Asset
            name="hand"
            p={[2.1, 0.04, 2]}
            rotation={[0, 1.6, 0]}
            scale={0.7}
          />
          <Asset
            name="baton"
            p={[3.3, 0.08, 1.8]}
            rotation={[0, 0.4, Math.PI / 2]}
            scale={0.7}
          />
          <Cable
            points={[
              [-3.5, 1, 0],
              [-2.9, 0.1, 0.4],
              [-2.3, 0.04, 1.3],
            ]}
          />
          <Part
            p={[-2.7, 3.1, 1]}
            s={[1.8, 0.12, 0.5]}
            rotation={[0, 0, 0.25]}
            color="#424b4b"
          />
          <Tube p={[-2.7, 3, 1]} length={1.5} color="#657e74" r={0.04} />
        </>
      )}
      {index === 2 && (
        <>
          <Part p={[4.8, 1.5, 2.8]} s={[0.1, 1.5, 1.5]} color="#0d161b" />
          <Part
            p={[4.2, 1.5, 3.4]}
            s={[1.2, 1.5, 0.07]}
            rotation={[0, 0.5, 0]}
            map="wall"
          />
          {[0, 1, 2].map((n) => (
            <Cable
              key={n}
              points={[
                [4.6, 2.1, 2.5 + n * 0.2],
                [4.1, 1, 2.6 + n * 0.2],
                [3.7, 0.05, 2.9 + n * 0.2],
              ]}
              color={n === 1 ? "#93603b" : "#162026"}
            />
          ))}
          <Asset name="cutter" p={[3.6, 0.15, 3.3]} rotation={[0, 1.2, 1.5]} />
          <Asset name="cell" p={[3.3, 0.06, 2.6]} />
        </>
      )}
      {index === 3 && (
        <>
          {[-1, 0, 1].map((n) => (
            <group key={n} position={[-3.8, 0, n * 1.25]}>
              <Part p={[0, 1.6, 0]} s={[1.1, 2.9, 1.1]} color="#4a5552" />
              <Sign
                p={[0, 2, -0.57]}
                width={0.8}
                height={0.4}
                text={n === 0 ? "NO SIGNAL" : "CAM / 0" + (n + 2)}
                screen
              />
            </group>
          ))}
          <Part
            p={[2.9, 0.7, 2.8]}
            s={[2.2, 1.4, 0.25]}
            rotation={[0, 0.35, 0]}
            color="#716649"
          />
          <Part
            p={[2.9, 1.35, 2.75]}
            s={[2.2, 0.1, 0.3]}
            rotation={[0, 0.35, 0]}
            color="#c49d57"
          />
          <Asset
            name="log"
            p={[-2.2, 0.03, 4.3]}
            rotation={[0, 1.1, 0]}
            scale={0.5}
          />
          <Ring
            p={[4.7, 1, 0]}
            rotation={[0, Math.PI / 2, 0]}
            r={0.65}
            color="#ad744e"
          />
        </>
      )}
      {index === 4 && (
        <>
          <Tube p={[0, 3.45, 1.5]} length={8.6} r={0.26} color="#9b7754" />
          <Tube p={[0, 3.05, -2.5]} length={8.6} r={0.13} />
          {[-1, 1].map((side) => (
            <group key={side}>
              <Part
                p={[side * 3, 0.16, 0.5]}
                s={[2.8, 0.32, 4.2]}
                color="#413d31"
              />
              <Ring
                p={[side * 3, 2.8, 1]}
                r={0.65}
                rotation={[Math.PI / 2, 0, 0]}
                color="#ac7950"
              />
              <Part
                p={[side * 3, 0.03, -2.2]}
                s={[2.7, 0.06, 0.8]}
                color="#77623c"
              />
            </group>
          ))}
        </>
      )}
      {index === 5 && (
        <>
          <group position={[3.6, 0, 0.5]}>
            <Tube
              p={[0, 1.6, 0]}
              length={2.5}
              r={0.8}
              rotation={[0, 0, 0]}
              color="#29434b"
            />
            {[0.4, 1, 2.1, 2.8].map((y) => (
              <Ring
                key={y}
                p={[0, y, 0]}
                r={0.83}
                rotation={[Math.PI / 2, 0, 0]}
              />
            ))}
            <Asset name="artifact" p={[0, 1.4, -0.77]} scale={1.4} />
            <Part
              p={[0, 1.6, -0.8]}
              s={[0.04, 2.1, 0.04]}
              glow
              color="#648d89"
            />
          </group>
          <group position={[-3.2, 1.2, 3]} rotation={[0, 0, 0.45]}>
            <Tube p={[0, 0, 0]} length={0.8} r={0.1} rotation={[0, 0, 0]} />
            <Ring p={[0, 0.4, 0]} r={0.17} />
            <Tube p={[0.4, 0.4, 0]} length={0.8} r={0.075} />
            <Asset name="hand" p={[0.85, 0.4, 0]} rotation={[0, 0, -1.5]} />
          </group>
          {[0, 1, 2, 3].map((n) => (
            <Part
              key={n}
              p={[-2.4 + n * 0.22, 0.03, 2.4 + Math.sin(n) * 0.4]}
              s={[0.2, 0.02, 0.15]}
              rotation={[0, n, 0]}
              color="#6e9596"
            />
          ))}
        </>
      )}
      {index === 6 && (
        <>
          {[-1, 0, 1].map((n) => (
            <Cable
              key={n}
              radius={0.09}
              points={[
                [4, 0.15, -3 + n * 0.3],
                [2.8, 0.15, -2 + n * 0.3],
                [2.4, 3.3, 1 + n * 0.3],
                [-2.4, 3.3, 2 + n * 0.3],
                [-4, 1.4, 3 + n * 0.3],
              ]}
            />
          ))}
          <Asset
            name="sentinel"
            p={[3.2, 0.25, -3]}
            rotation={[0, -1.2, 1.4]}
            scale={0.7}
          />
          <Asset
            name="terminal"
            p={[3.2, 0, -1.5]}
            rotation={[0, Math.PI, 0]}
          />
          {[-1, 1].map((side) => (
            <group key={side}>
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <Part
                  key={n}
                  p={[side * 3.67, 0.6 + n * 0.3, 2.4]}
                  s={[0.03, 0.06, 0.22]}
                  color={
                    Math.floor(run.elapsed * 2 + n) % 5 === 0
                      ? "#bf8b54"
                      : "#6eacb6"
                  }
                  glow
                />
              ))}
            </group>
          ))}
        </>
      )}
      {index === 7 && (
        <>
          <Part p={[0, 1.95, 5.1]} s={[3.9, 3.9, 0.55]} color="#657a7a" />
          <Part p={[0, 1.95, 4.79]} s={[0.06, 3.8, 0.05]} color="#101a20" />
          {[-1, 1].map((side) => (
            <Part
              key={side}
              p={[side * 1.2, 1.9, 4.7]}
              s={[0.22, 3.2, 0.2]}
              color="#a6b3a5"
            />
          ))}
        </>
      )}
      {event?.kind === "STEAM_RELEASE" && index === roomAt(run.z) && (
        <Steam run={run} position={[3.8, 0.3, 1]} />
      )}
    </group>
  );
}
