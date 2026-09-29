import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import * as T from "three";
import type { Run } from "./game";
import { audio } from "./audio";
import { Steam } from "./effects";
import { usePresentation } from "./presentation";
import { ChamberAudio } from "./chamber-audio";

/** A separate Blender-authored benchmark; no shared facility assets are modified. */
export function Containment({ run, low, active }: { run: Run; low: boolean; active: boolean }) {
  const { scene } = useGLTF("/models/containment.glb", "/draco/");
  const gl = useThree(s => s.gl);
  useEffect(() => {
    if (!active) return;
    const previous = gl.transmissionResolutionScale;
    gl.transmissionResolutionScale = .5;
    return () => { gl.transmissionResolutionScale = previous; };
  }, [gl, active]);
  const reducedMotion = usePresentation(s => s.reducedMotion);
  const model = useMemo(() => {
    const copy = scene.clone(true);
    const materials = new Map<string, T.Material>();
    copy.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      let parent: T.Object3D | null = object;
      let moving = false;
      while (parent) {
        if (/^CH_(Door_|Pod_Canopy|Bay_Canopy|Vent_Fan)/.test(parent.name)) moving = true;
        parent = parent.parent;
      }
      const convert = (source: T.Material) => {
        const key = `${source.uuid}/${moving}`;
        if (materials.has(key)) return materials.get(key)!;
        const m = source.clone() as T.MeshPhysicalMaterial;
        // Static contact UVs describe fixed furniture only; moving parts must not sample that atlas.
        if (moving) m.aoMap = null;
        if (m.map) m.map.anisotropy = 8;
        if (m.name === "CH_Laminated_Glass") {
          m.transmission = low ? 0 : .96;
          m.transparent = true;
          m.opacity = low ? .22 : 1;
          m.roughness = .13;
          m.thickness = .018;
          m.ior = 1.46;
          m.attenuationColor = new T.Color("#a4c4b6");
          m.attenuationDistance = 1.8;
          m.depthWrite = false;
          m.side = T.DoubleSide;
        }
        materials.set(key, m);
        return m;
      };
      object.material = Array.isArray(object.material) ? object.material.map(convert) : convert(object.material);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      if (list.some(m => m.name === "CH_Laminated_Glass")) object.castShadow = false;
    });
    return { copy, materials };
  }, [scene, low]);
  useEffect(() => () => model.materials.forEach(m => m.dispose()), [model]);
  const mechanisms = useMemo(() => ({
    left: model.copy.getObjectByName("CH_Door_Left"),
    right: model.copy.getObjectByName("CH_Door_Right"),
    canopy: model.copy.getObjectByName("CH_Pod_Canopy"),
    bay: model.copy.getObjectByName("CH_Bay_Canopy"),
    fan: model.copy.getObjectByName("CH_Vent_Fan"),
  }), [model]);
  const door = useRef({ amount: 0, requestAt: -1, open: false });
  useFrame((_, delta) => {
    const state = door.current;
    const request = Math.abs(run.z - 6) < 4.8;
    if (request && state.requestAt < 0) state.requestAt = run.elapsed;
    if (!request) state.requestAt = -1;
    const open = request && run.elapsed - state.requestAt > .4;
    state.amount = T.MathUtils.damp(state.amount, open ? 1 : 0, 5, Math.min(delta, .05));
    if (mechanisms.left) mechanisms.left.position.x = -state.amount * 1.64;
    if (mechanisms.right) mechanisms.right.position.x = state.amount * 1.64;
    if (open !== state.open) {
      audio.cueAt("door", 0, 6, run.x, run.z);
      state.open = open;
    }
    // Canopy pivots clear of the original spawn and forward walking lane.
    if (mechanisms.canopy) mechanisms.canopy.rotation.y = -T.MathUtils.smoothstep(run.elapsed, .7, 3) * 1.72;
    if (mechanisms.bay) mechanisms.bay.rotation.y = -.24;
    if (mechanisms.fan && !reducedMotion) mechanisms.fan.rotation.x = run.elapsed * .9;
  });
  return <group>
    <primitive object={model.copy} />
    <ScannedEquipment />
    <ChamberLight position={[-2.8, 2.88, 2.3]} intensity={48} low={low} run={run} />
    <ChamberLight position={[2.8, 2.88, -2]} intensity={35} low={low} run={run} />
    <pointLight position={[0, 2.8, 4.8]} color="#c4d4cc" intensity={10} distance={6} decay={2} />
    <pointLight position={[3.7, 2.48, 5.48]} color="#ffad58" intensity={4} distance={4} decay={2} />
    <pointLight position={[0, 2.4, -.15]} color="#bfd7cd" intensity={3} distance={3} decay={2} />
    <Monitor position={[-2.03, 1.26, 3.122]} elapsed={run.elapsed} reducedMotion={reducedMotion} />
    <Monitor position={[3.55, 1.26, -2.578]} elapsed={run.elapsed} reducedMotion={reducedMotion} />
    {active && <>
      <ChamberAudio run={run} />
      <Environment resolution={low ? 64 : 128} frames={1} environmentIntensity={.38}>
        <mesh scale={[10, 6.4, 12]}>
          <boxGeometry /><meshBasicMaterial color="#414846" side={T.BackSide} />
        </mesh>
        <Lightformer position={[-2.8, 3, 2.3]} rotation={[Math.PI / 2, 0, 0]} scale={[.4, 1.5, 1]} intensity={5} color="#dce6df" />
        <Lightformer position={[2.8, 3, -2]} rotation={[Math.PI / 2, 0, 0]} scale={[.4, 1.5, 1]} intensity={4} color="#dce6df" />
        <Lightformer position={[3.7, 2.5, 5.5]} rotation={[0, Math.PI, 0]} scale={[.3, .1, 1]} intensity={3} color="#efad70" />
      </Environment>
      <Steam run={run} position={[.84, .3, -.1]} boot />
    </>}
  </group>;
}

function ScannedEquipment() {
  const { scene } = useGLTF('/models/containment-props.glb', '/draco/');
  const model = useMemo(() => {
    const copy = scene.clone(true);
    copy.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
    return copy;
  }, [scene]);
  return <primitive object={model} />;
}

function ChamberLight({ position, intensity, low, run }: { position: [number, number, number]; intensity: number; low: boolean; run: Run }) {
  const light = useRef<T.SpotLight>(null);
  const shadowState = useRef({ near: false, changed: -1, initialized: false });
  useFrame(() => {
    if (!light.current || low) return;
    const s = shadowState.current, near = Math.abs(run.z - 6) < 4.8;
    if (near !== s.near) { s.near = near; s.changed = run.elapsed; }
    light.current.shadow.needsUpdate = !s.initialized || run.elapsed < 4 || run.elapsed - s.changed < 2.5;
    s.initialized = true;
  });
  const target = useMemo(() => {
    const o = new T.Object3D(); o.position.set(position[0], 0, position[2]); return o;
  }, [position[0], position[2]]);
  return <>
    <primitive object={target} />
    <spotLight ref={light} position={position} target={target} intensity={intensity} color="#d7e2d9" angle={1.2} penumbra={.65} distance={11} decay={2} shadow-autoUpdate={false}
      castShadow={!low} shadow-mapSize={[1024, 1024]} shadow-bias={-.00015} shadow-normalBias={.012} shadow-camera-near={.1} shadow-camera-far={12} />
  </>;
}

function Monitor({ position, elapsed, reducedMotion }: { position: [number, number, number]; elapsed: number; reducedMotion: boolean }) {
  const display = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 288;
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    return { canvas, texture, last: -1 };
  }, []);
  useEffect(() => () => display.texture.dispose(), [display]);
  useFrame(() => {
    const frame = Math.floor(elapsed * (reducedMotion ? 1 : 12));
    if (frame === display.last) return;
    display.last = frame;
    const c = display.canvas.getContext("2d")!;
    c.fillStyle = "#071111"; c.fillRect(0, 0, 512, 288);
    c.fillStyle = "#91aca1"; c.font = "18px monospace"; c.fillText("RECOVERY / TELEMETRY", 20, 30);
    c.font = "52px monospace"; c.fillStyle = "#a3c7b1"; c.fillText("72", 370, 103);
    c.font = "14px monospace"; c.fillText("BPM", 442, 101);
    c.strokeStyle = "#79b399"; c.lineWidth = 2; c.beginPath();
    for (let x = 20; x < 350; x++) {
      const t = ((x + (reducedMotion ? 0 : frame * 5)) % 95) / 95;
      const y = 110 + (t > .35 && t < .44 ? -Math.sin((t - .35) / .09 * Math.PI) * 52 : t > .44 && t < .51 ? Math.sin((t - .44) / .07 * Math.PI) * 17 : Math.sin(t * Math.PI * 2) * 3);
      if (x === 20) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.stroke(); c.font = "20px monospace"; c.fillStyle = "#b6c8bd";
    c.fillText("SpO2  98%", 20, 183); c.fillText("36.8 C", 340, 183);
    c.fillStyle = "#b79c6d"; c.font = "16px monospace";
    c.fillText(elapsed < 4 ? "SEAL RELEASE / STAND CLEAR" : "PATIENT DISCONNECTED", 20, 252);
    display.texture.needsUpdate = true;
  });
  return <mesh position={position} rotation={[0, Math.PI, 0]}>
    <planeGeometry args={[.429, .249]} /><meshBasicMaterial map={display.texture} toneMapped={false} />
  </mesh>;
}
