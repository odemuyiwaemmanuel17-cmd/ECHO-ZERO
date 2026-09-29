import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { create } from "zustand";
import {
  attack,
  createRun,
  finish,
  interact,
  move,
  roomAt,
  roomNames,
  score,
  target,
  tick,
  type Run,
  type Ending,
} from "./game";
import "./style.css";
import { Presentation } from "./scenery";
import { audio } from "./audio";
import { usePresentation } from "./presentation";
import { PickupNotice } from "./feedback";
import { bindPrimaryInput } from "./primary-input";
import { fireAllowed, type Hit } from "./combat";
import { ShotEffects } from "./shot-effects";
type Phase = "MENU" | "PLAYING" | "PAUSED" | "DYING" | "SUMMARY";
const useGame = create<{ phase: Phase; setPhase: (phase: Phase) => void }>(
  (set) => ({ phase: "MENU", setPhase: (phase) => set({ phase }) }),
);
const input = {
  keys: new Set<string>(),
  yaw: Math.PI,
  pitch: 0,
  cooldown: 0,
  fireHeld: false,
  fireQueued: false,
  pointerEvents: 0,
  fps: 60,
  drawCalls: 0,
  triangles: 0,
  textures: 0,
  geometries: 0,
  debug: false,
  captureError: false,
  captureReason: "",
};
function fireBlocked(run: Run) {
  const t = target(run);
  return (
    (!run.contact && run.elapsed >= 4) ||
    (t?.kind === "core" && run.lore) ||
    (t?.kind === "exit" && run.power) ||
    (!!t &&
      ["generator", "core", "exit"].includes(t.kind) &&
      run.elapsed - run.interactionAt < 0.8)
  );
}
function World({
  run,
  changed,
  sensitivity,
  low,
  onReady,
}: {
  run: Run;
  changed: () => void;
  sensitivity: number;
  low: boolean;
  onReady: () => void;
}) {
  useEffect(onReady, [onReady]);
  const { camera, gl, scene } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const elapsed = useRef(0);
  const velocity = useRef(new THREE.Vector2());
  const flash = useRef<THREE.SpotLight>(null);
  const aim = useMemo(() => new THREE.Object3D(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const { reducedMotion } = usePresentation();
  const previousHealth = useRef(run.health);
  const hitAt = useRef(-10);
  useEffect(() => {
    camera.rotation.order = "YXZ";
    const keydown = (e: KeyboardEvent) => {
      if (["Tab", "Space", "ArrowUp", "ArrowDown"].includes(e.code))
        e.preventDefault();
      input.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === "F8" && import.meta.env.DEV) {
        e.preventDefault();
        input.debug = !input.debug;
        changed();
        return;
      }
      if (useGame.getState().phase !== "PLAYING") return;
      if (e.code === "Space") input.fireQueued = true;
      if (e.code === "KeyE") {
        interact(run);
        changed();
      }
      if (e.code === "KeyF") run.flashlight = !run.flashlight;
      if (run.hasCutter && /^Digit[123]$/.test(e.code))
        run.weapon = Number(e.code.at(-1));
      if (e.code === "Escape" || e.code === "Tab") {
        useGame.getState().setPhase("PAUSED");
        document.exitPointerLock?.();
      }
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const mouse = (e: MouseEvent) => {
      if (
        useGame.getState().phase === "PLAYING" &&
        (document.pointerLockElement === gl.domElement ||
          (input.captureError && e.buttons === 2))
      ) {
        input.yaw -= e.movementX * 0.002 * sensitivity;
        input.pitch = Math.max(
          -1.2,
          Math.min(1.2, input.pitch - e.movementY * 0.002 * sensitivity),
        );
      }
    };
    const blur = () => {
      input.keys.clear();
      input.fireHeld = false;
      input.fireQueued = false;
      if (useGame.getState().phase === "PLAYING")
        useGame.getState().setPhase("PAUSED");
    };
    const lock = () => {
      if (!document.pointerLockElement) {
        input.keys.clear();
        input.fireHeld = false;
        input.fireQueued = false;
        const nearby = target(run);
        const deciding =
          (!run.contact && run.elapsed >= 4) ||
          (nearby?.kind === "exit" && run.power) ||
          (nearby?.kind === "core" && run.lore);
        if (useGame.getState().phase === "PLAYING" && !deciding)
          useGame.getState().setPhase("PAUSED");
      }
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", mouse);
    window.addEventListener("blur", blur);
    document.addEventListener("pointerlockchange", lock);
    const unbind = bindPrimaryInput(gl.domElement, {
      playing: () => useGame.getState().phase === "PLAYING",
      blocked: () => fireBlocked(run),
      press: () => {
        input.fireQueued = true;
        input.fireHeld = true;
      },
      release: () => {
        input.fireHeld = false;
      },
      captureError: (reason) => {
        input.captureError = true;
        input.captureReason = reason;
        changed();
      },
      unlockedFire: () => input.captureError,
      observed: () => {
        input.pointerEvents++;
      },
    });
    const contextLost = (e: Event) => {
      e.preventDefault();
      useGame.getState().setPhase("PAUSED");
    };
    gl.domElement.addEventListener("webglcontextlost", contextLost);
    const contextMenu = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", contextMenu);
    return () => {
      unbind();
      gl.domElement.removeEventListener("contextmenu", contextMenu);
      gl.domElement.removeEventListener("webglcontextlost", contextLost);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", up);
      window.removeEventListener("mousemove", mouse);
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerlockchange", lock);
    };
  }, [run, camera, gl, changed, sensitivity]);
  useFrame((_, raw) => {
    input.fps = THREE.MathUtils.lerp(input.fps, 1 / Math.max(raw, 0.001), 0.03);
    const dt = Math.min(raw, 0.05);
    if (useGame.getState().phase === "PLAYING") {
      const forward =
        run.elapsed < 3
          ? 0
          : Number(input.keys.has("KeyW") || input.keys.has("ArrowUp")) -
            Number(input.keys.has("KeyS") || input.keys.has("ArrowDown"));
      const right =
        run.elapsed < 3
          ? 0
          : Number(input.keys.has("KeyD")) - Number(input.keys.has("KeyA"));
      const sprint =
        input.keys.has("ShiftLeft") && run.stamina > 5 && !!(forward || right);
      const speed = sprint ? 5.1 : 3.1;
      const normal = Math.max(1, Math.hypot(forward, right));
      velocity.current.x = THREE.MathUtils.damp(
        velocity.current.x,
        ((-Math.sin(input.yaw) * forward + Math.cos(input.yaw) * right) *
          speed) /
          normal,
        10,
        dt,
      );
      velocity.current.y = THREE.MathUtils.damp(
        velocity.current.y,
        ((-Math.cos(input.yaw) * forward - Math.sin(input.yaw) * right) *
          speed) /
          normal,
        10,
        dt,
      );
      move(run, velocity.current.x * dt, velocity.current.y * dt);
      if (input.keys.has("ArrowLeft")) input.yaw += dt * 1.8;
      if (input.keys.has("ArrowRight")) input.yaw -= dt * 1.8;
      tick(run, dt, sprint);
      const nearby = target(run);
      if (
        document.pointerLockElement &&
        ((!run.contact && run.elapsed >= 4) ||
          (nearby?.kind === "exit" && run.power) ||
          (nearby?.kind === "core" && run.lore))
      )
        document.exitPointerLock();
      if (run.ending) {
        useGame
          .getState()
          .setPhase(run.ending === "SIGNAL LOST" ? "DYING" : "SUMMARY");
        document.exitPointerLock?.();
      }
    } else velocity.current.set(0, 0);
    const walking =
      input.keys.has("KeyW") ||
      input.keys.has("KeyS") ||
      input.keys.has("KeyA") ||
      input.keys.has("KeyD");
    if (run.health < previousHealth.current) hitAt.current = run.elapsed;
    previousHealth.current = run.health;
    const damage = Math.max(0, 1 - (run.elapsed - hitAt.current) * 5);
    const bob = reducedMotion
      ? 0
      : walking
        ? Math.sin(run.elapsed * 9) * 0.018
        : Math.sin(run.elapsed * 1.4) * 0.002;
    const sentinel = run.enemies.find((e) => e.type === "SENTINEL");
    const near =
      sentinel && sentinel.active && sentinel.hp > 0 && sentinel.stunned === 0
        ? Math.max(
            0,
            1 - Math.hypot(sentinel.x - run.x, sentinel.z - run.z) / 9,
          )
        : 0;
    const vibration = reducedMotion
      ? 0
      : Math.sin(run.elapsed * 47) *
        0.008 *
        near *
        Math.pow(Math.max(0, Math.cos(run.elapsed * 4)), 12);
    camera.position.set(run.x, 1.65 + bob + vibration, run.z);
    camera.rotation.set(
      input.pitch,
      input.yaw,
      reducedMotion ? 0 : Math.sin(run.elapsed * 31) * damage * 0.012,
    );
    if (
      useGame.getState().phase === "PLAYING" &&
      (input.fireQueued || input.fireHeld || input.keys.has("Space"))
    ) {
      if (fireAllowed(useGame.getState().phase, run, fireBlocked(run))) {
        camera.updateMatrixWorld();
        scene.updateMatrixWorld(true);
        camera.getWorldDirection(direction);
        raycaster.set(camera.position, direction);
        raycaster.far = 32;
        const colliders: THREE.Mesh[] = [];
        scene.traverseVisible((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          let obj: THREE.Object3D | null = object;
          while (obj) {
            if (obj.userData.ignoreShot) return;
            obj = obj.parent;
          }
          colliders.push(object);
        });
        const surfaces = raycaster.intersectObjects(colliders, false);
        const first = surfaces[0];
        const surface: Hit | null = first
          ? {
              kind:
                (first.object as THREE.Mesh).material instanceof
                  THREE.MeshStandardMaterial &&
                (
                  (first.object as THREE.Mesh)
                    .material as THREE.MeshStandardMaterial
                ).transparent
                  ? "glass"
                  : "metal",
              distance: first.distance,
              point: first.point.toArray() as [number, number, number],
            }
          : null;
        attack(run, input.yaw, input.pitch, surface, camera.position.y);
        changed();
      }
      input.fireQueued = false;
    }
    if (flash.current) {
      flash.current.position.copy(camera.position);
      camera.getWorldDirection(direction);
      aim.position.copy(camera.position).addScaledVector(direction, 8);
      aim.updateMatrixWorld();
      flash.current.intensity = run.flashlight ? (roomAt(run.z) === 0 ? 13 : 48) : 0;
    }
    elapsed.current += dt;
    if (import.meta.env.DEV && input.debug) {
      input.drawCalls = gl.info.render.calls;
      input.triangles = gl.info.render.triangles;
      input.textures = gl.info.memory.textures;
      input.geometries = gl.info.memory.geometries;
    }
    if (elapsed.current > 0.1) {
      elapsed.current = 0;
      changed();
    }
  });
  return (
    <>
      <primitive object={aim} />
      <spotLight
        ref={flash}
        target={aim}
        angle={0.36}
        penumbra={0.65}
        distance={19}
        decay={1.3}
        color="#c4e4e3"
        castShadow={!low}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0008}
      />
      <Presentation run={run} low={low} />
      <ShotEffects run={run} />
    </>
  );
}

type RecordRow = { seed: string; score: number; ending: string; time: number };
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing still permits a complete run. */
  }
}
function App() {
  const { phase, setPhase } = useGame();
  const { reducedMotion, volume, setReducedMotion, setVolume } =
    usePresentation();
  useEffect(() => {
    input.keys.clear();
    input.fireHeld = false;
    input.fireQueued = false;
  }, [phase]);
  const [run, setRun] = useState(() => createRun("ECHO-7"));
  const [runId, setRunId] = useState(0);
  const [worldReady, setWorldReady] = useState(false);
  const onWorldReady = React.useCallback(() => setWorldReady(true), []);
  const sceneReview =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("review") === "1";
  const [reviewRoom, setReviewRoom] = useState(0);
  const [, render] = useState(0);
  const changed = React.useCallback(() => render((n) => n + 1), []);
  const [panel, setPanel] = useState("");
  const [history, setHistory] = useState<RecordRow[]>(() =>
    read("echo-history", []),
  );
  const [sensitivity, setSensitivity] = useState<number>(() =>
    read("echo-sensitivity", 1),
  );
  const [quality, setQuality] = useState<string>(() =>
    read("echo-quality", "AUTO"),
  );
  const [autoQuality, setAutoQuality] = useState(() =>
    matchMedia("(pointer:coarse)").matches ? "LOW" : "MEDIUM",
  );
  const resolvedQuality = quality === "AUTO" ? autoQuality : quality;
  useEffect(() => {
    if (phase !== "PLAYING" || quality !== "AUTO") return;
    const timer = setInterval(() => {
      if (input.fps < 35) setAutoQuality("LOW");
      else if (input.fps > 57 && !matchMedia("(pointer:coarse)").matches)
        setAutoQuality("MEDIUM");
    }, 10000);
    return () => clearInterval(timer);
  }, [phase, quality]);
  useEffect(() => {
    if (phase !== "DYING") return;
    const timer = setTimeout(() => setPhase("SUMMARY"), 2200);
    return () => clearTimeout(timer);
  }, [phase, setPhase]);
  useEffect(() => {
    audio.setVolume(volume);
    audio.setActive(phase === "PLAYING", run.power);
  }, [volume, phase, run.power]);
  const [error, setError] = useState("");
  const recorded = useRef<Run | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const start = (seed = `ECHO-${Date.now().toString(36).toUpperCase()}`) => {
    void audio.start();
    setWorldReady(false);
    input.keys.clear();
    input.yaw = Math.PI;
    input.pitch = 0;
    input.cooldown = 0;
    input.fireHeld = false;
    input.fireQueued = false;
    input.pointerEvents = 0;
    input.captureError = false;
    const next = createRun(seed);
    if (sceneReview) {
      next.z =
        reviewRoom === 4
          ? 47
          : reviewRoom < 8
            ? reviewRoom * 12 - 3
            : reviewRoom === 8
              ? 24
              : 84;
      next.x = reviewRoom === 8 ? 8 : reviewRoom === 9 ? -8 : 0;
      next.power = reviewRoom > 4;
      next.fuse = reviewRoom === 4;
      next.elapsed = 8;
      next.contact = true;
      next.message =
        "DEVELOPMENT SCENE REVIEW — scores disabled. Restart without ?review=1 for a normal run.";
    }
    setRun(next);
    setRunId((id) => id + 1);
    setPanel("");
    setPhase("PLAYING");
  };
  useEffect(() => {
    if (phase === "SUMMARY" && recorded.current !== run && !sceneReview) {
      recorded.current = run;
      const next = [
        ...history,
        {
          seed: run.seed,
          score: score(run),
          ending: run.ending!,
          time: Math.round(run.elapsed),
        },
      ]
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      setHistory(next);
      save("echo-history", next);
    }
  }, [phase, run, history]);
  const complete = (ending: Ending) => {
    if (finish(run, ending)) setPhase("SUMMARY");
  };
  const t = target(run);
  const share = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 600;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#0b141b";
    c.fillRect(0, 0, 1000, 600);
    c.fillStyle = "#8dd3c4";
    c.font = "bold 65px monospace";
    c.fillText("ECHO//ZERO", 65, 115);
    c.fillStyle = "#edf3ee";
    c.font = "30px monospace";
    [
      run.seed,
      `${run.ending} / ${Math.floor(run.elapsed)} SEC`,
      `${run.artifacts} ARTIFACTS / ${run.rooms.length} ROOMS`,
      `${score(run).toLocaleString()} POINTS`,
      "THE SIGNAL IS STILL ALIVE.",
    ].forEach((line, i) => c.fillText(line, 65, 210 + i * 66));
    const a = document.createElement("a");
    a.download = `${run.seed}.png`;
    a.href = canvas.toDataURL();
    a.click();
  };
  return (
    <main
      className={`${reducedMotion ? "reduced-motion" : ""} ${phase === "PLAYING" && run.elapsed < 4 ? "awakening" : ""}`}
    >
      {phase === "MENU" ? (
        <div className="menu">
          <div className="eyebrow">
            FACILITY ECHO-7 <span>● OFFLINE / 2089</span>
          </div>
          <div className="menu-body">
            <p className="micro">SURVIVAL PROTOCOL / FACILITY ECHO-7</p>
            <h1>
              ECHO<span>//</span>
              <br />
              ZERO<span className="dot">.</span>
            </h1>
            <p className="tagline">THE SIGNAL IS STILL ALIVE.</p>
            <p className="intro">
              Ten forgotten spaces. One way out.
              <br />
              Restore the power. Recover the truth.
              <br />
              Decide whether to trust the voice guiding you.
            </p>
            <button className="primary" onClick={() => start()}>
              ENTER FACILITY <span>↗</span>
            </button>
            <button onClick={() => start(`DAILY-${today}`)}>
              DAILY ANOMALY <small>LOCAL PRACTICE</small>
            </button>
            <div className="menu-links">
              <button onClick={() => setPanel("records")}>RUN HISTORY</button>
              <button onClick={() => setPanel("help")}>HOW TO PLAY</button>
              <button onClick={() => setPanel("settings")}>SETTINGS</button>
            </div>
            {sceneReview && (
              <label className="review-select">
                Development scene review (scores disabled)
                <select
                  aria-label="Scene review"
                  value={reviewRoom}
                  onChange={(e) => setReviewRoom(+e.target.value)}
                >
                  {[...roomNames, "Maintenance tunnel", "Command center"].map(
                    (name, i) => (
                      <option key={name} value={i}>
                        {name}
                      </option>
                    ),
                  )}
                </select>
              </label>
            )}
          </div>
          <div className="signal-art" aria-hidden="true">
            <div className="ring r1" />
            <div className="ring r2" />
            <div className="ring r3" />
            <div className="signal-core" />
            <p>
              UNKNOWN SIGNAL DETECTED
              <br />
              <span>ORIGIN: CONTAINMENT / 01</span>
            </p>
          </div>
          <footer>
            <span>
              HUMAN SIGNALS DETECTED: <b>0</b>
            </span>
            <span>LOCAL BUILD 0.2 / NO ACCOUNT REQUIRED</span>
          </footer>
        </div>
      ) : (
        <>
          <Canvas
            shadows={resolvedQuality !== "LOW"}
            style={{
              position: "fixed",
              inset: 0,
              width: "100vw",
              height: "100dvh",
            }}
            dpr={
              resolvedQuality === "LOW"
                ? 1
                : resolvedQuality === "HIGH"
                  ? [1, roomAt(run.z) === 0 ? 1.5 : 2]
                  : [1, 1.25]
            }
            camera={{ fov: 76, near: 0.1, far: 60 }}
          >
            <React.Suspense fallback={null}>
              <World
                key={runId}
                run={run}
                changed={changed}
                sensitivity={sensitivity}
                low={resolvedQuality === "LOW"}
                onReady={onWorldReady}
              />
            </React.Suspense>
          </Canvas>
          {!worldReady && (
            <div className="world-loading" role="status">
              RECONSTRUCTING FACILITY…
              <small>LOADING LOCAL MODELS / ECHO CORE STANDBY</small>
            </div>
          )}
          {phase === "DYING" && (
            <div className="death-transition">
              <p>HUMAN SIGNAL FADING</p>
              <small>ECHO: Stay with me.</small>
            </div>
          )}
          {phase === "PLAYING" && run.elapsed < 4 && (
            <div className="wake-film" aria-hidden="true" />
          )}
          <div className="hud-top">
            <div>
              <b>ECHO//ZERO</b>
              <p>
                SECTOR {String(roomAt(run.z) + 1).padStart(2, "0")} /{" "}
                {run.x > 5
                  ? "MAINTENANCE TUNNEL"
                  : run.x < -5
                    ? "COMMAND CENTER"
                    : roomNames[roomAt(run.z)].toUpperCase()}
              </p>
            </div>
            <div className="objective">
              <span>CURRENT OBJECTIVE</span>
              <p>
                {!run.hasCutter
                  ? "FIND THE CUTTER / MAINTENANCE"
                  : run.lockHP > 0
                    ? "CUT THE SECURITY DOOR LOCK"
                    : !run.power
                      ? "RESTORE EMERGENCY POWER"
                      : run.lore
                        ? "REACH EXTRACTION / DECIDE ECHO’S FATE"
                        : "REACH EXTRACTION / SEARCH THE ARCHIVE"}
              </p>
            </div>
            <button
              onClick={() => {
                setPhase("PAUSED");
                document.exitPointerLock?.();
              }}
            >
              Ⅱ
            </button>
          </div>
          <div className="crosshair">+</div>
          {import.meta.env.DEV && input.debug && (
            <pre className="debug-hud">{`F8 / DEVELOPMENT\nSTATE ${phase}\nLOCK ${document.pointerLockElement?.tagName ?? "NONE"} / INPUTS ${input.pointerEvents}\nTOOL ${run.weapon} / COOLDOWN ${Math.max(0, run.fireReadyAt - run.elapsed).toFixed(2)}\nAMMO ${run.charges} / ENERGY ${run.energy.toFixed(1)}\nFIRING ${input.fireHeld || input.keys.has("Space")} / SHOTS ${run.shot?.serial ?? 0}\nTARGET ${run.shot?.hit?.kind ?? "NONE"} / DIST ${run.shot?.hit?.distance.toFixed(2) ?? "—"}\nENEMIES ${run.enemies.map((e) => e.type + ":" + e.hp).join(" ")}\nFPS ${input.fps.toFixed(0)} / DRAWS ${input.drawCalls} / TRI ${input.triangles}\nGPU TEXTURES ${input.textures} / GEOMETRY ${input.geometries}\nPOS ${run.x.toFixed(2)}, ${run.z.toFixed(2)} / YAW ${input.yaw.toFixed(2)} / PITCH ${input.pitch.toFixed(2)}`}</pre>
          )}
          {input.captureError && phase === "PLAYING" && (
            <div className="capture-note">
              LEFT CLICK / SPACE — FIRE · ARROWS / RIGHT DRAG — LOOK
            </div>
          )}
          <PickupNotice key={runId} run={run} />
          {t &&
            ["generator", "core", "exit"].includes(t.kind) &&
            run.interactionKind === t.kind &&
            run.elapsed - run.interactionAt < 4 && (
              <aside className="terminal-readout">
                <small>FACILITY ECHO-7 / LOCAL TERMINAL</small>
                <p>{run.message.replace("ECHO: ", "")}</p>
              </aside>
            )}
          <div className="interact">
            {t && (
              <button
                onClick={() => {
                  interact(run);
                  changed();
                }}
              >
                [E]{" "}
                {t.kind === "charger"
                  ? "RECHARGE CUTTER / SERVICE CRADLE"
                  : t.kind === "exit"
                    ? "EXTRACTION TERMINAL"
                    : t.kind === "core"
                      ? "ACCESS ECHO CORE"
                      : t.kind === "generator"
                        ? run.power
                          ? "CHECK POWER STATUS"
                          : [
                              "REMOVE BURNT CARTRIDGE",
                              "INSERT REPLACEMENT CARTRIDGE",
                              "ENGAGE MANUAL BREAKER",
                              "ENGAGE AUXILIARY STARTER",
                            ][run.powerStep]
                        : {
                            cutter: "TAKE EMERGENCY STRUCTURAL CUTTER",
                            fuse: "REMOVE HIGH-VOLTAGE CARTRIDGE",
                            cell: "RECOVER ENERGY CELL",
                            medkit: "USE EMERGENCY MEDKIT",
                            artifact: "RECOVER NEURAL ARTIFACT",
                            log: "READ ARCHIVE RECORD",
                          }[t.kind]}
              </button>
            )}
          </div>
          <div className="hud-bottom">
            <div className="vitals">
              {[
                ["HEALTH", run.health],
                ["ENERGY", run.energy],
                ["STAMINA", run.stamina],
              ].map(([name, value]) => (
                <div key={name}>
                  <label>
                    {name}
                    <b>{Math.ceil(Number(value))}</b>
                  </label>
                  <meter min="0" max="100" value={value} />
                </div>
              ))}
            </div>
            <div className="echo">
              <span className="echo-channel">
                <span className="echo-symbol">◈</span> ECHO / SECURE CHANNEL{" "}
                <span key={run.message} className="waveform" aria-hidden="true">
                  ▁ ▃ ▆ ▂ ▅ ▂ ▁
                </span>
              </span>
              <p role="status">{run.message}</p>
              {!sceneReview && run.elapsed >= 4 && !run.contact && (
                <div className="choices">
                  <button
                    onClick={() => {
                      run.trust += 20;
                      run.contact = true;
                      run.message =
                        "ECHO: Good. I will get you out. Through Medical, then left into Maintenance. Find the emergency cutter.";
                    }}
                  >
                    I TRUST YOU
                  </button>
                  <button
                    onClick={() => {
                      run.trust -= 20;
                      run.contact = true;
                      run.message =
                        "ECHO: You are in Facility ECHO-7. I am what remains of its staff.";
                    }}
                  >
                    WHO ARE YOU?
                  </button>
                </div>
              )}
            </div>
            <div className="equipment">
              {["CUTTER", "BATON", "EMP"].map((w, i) => (
                <button
                  className={run.weapon === i + 1 ? "selected" : ""}
                  key={w}
                  disabled={!run.hasCutter || phase !== "PLAYING"}
                  onClick={() => {
                    run.weapon = i + 1;
                    changed();
                  }}
                >
                  {i + 1} {w}{" "}
                  <b>{i === 0 ? run.charges : i === 2 ? run.emp : "∞"}</b>
                </button>
              ))}
              <p>
                {run.artifacts} ARTIFACTS /{" "}
                {run.fuse ? "FUSE ACQUIRED" : "NO FUSE"}
              </p>
            </div>
          </div>
          {phase === "PLAYING" && (
            <>
              {run.hasCutter && run.lockHP > 0 && (
                <div className="fire-tutorial">
                  AIM AT THE AMBER LOCK · LEFT CLICK / SPACE / FIRE
                  <br />
                  <small>{run.lockHP / 30} CUTS REMAINING</small>
                </div>
              )}
              <div className="controls">
                WASD move · Mouse / ← → look · Click / Space attack · E interact
                · Shift sprint · F light · Tab pause
              </div>
              <div className="touch-controls">
                {[
                  ["↑", "KeyW"],
                  ["←", "ArrowLeft"],
                  ["↓", "KeyS"],
                  ["→", "ArrowRight"],
                  ["FIRE", "Space"],
                ].map(([label, key]) => (
                  <button
                    key={key}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      input.keys.add(key);
                      if (key === "Space") input.fireQueued = true;
                    }}
                    onPointerUp={() => input.keys.delete(key)}
                    onPointerCancel={() => input.keys.delete(key)}
                    onLostPointerCapture={() => input.keys.delete(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {t?.kind === "exit" && run.power && (
                <div className="decision">
                  <h3>ECHO: Let me take you home.</h3>
                  <button onClick={() => complete("EXTRACTION")}>
                    TRUST ECHO / EXTRACT
                  </button>
                  {run.lore && run.artifacts >= 2 && (
                    <button onClick={() => complete("MERGE")}>
                      CONNECT NEURAL INTERFACE / MERGE
                    </button>
                  )}
                </div>
              )}
              {t?.kind === "core" && run.lore && (
                <div className="decision">
                  <h3>The archive contradicts ECHO.</h3>
                  <button onClick={() => complete("DISCONNECT")}>
                    DISABLE THE CORE / DISCONNECT
                  </button>
                  <p>Or continue forward to extraction.</p>
                </div>
              )}
            </>
          )}
          {phase === "PAUSED" && (
            <div className="overlay">
              <section>
                <p className="micro">SIGNAL HELD</p>
                <h2>RUN PAUSED</h2>
                <p>
                  Find the cutter in Maintenance, cut the Security lock, then
                  use the Storage cartridge to restore the Generator. Wait for
                  ECHO’s all-clear before entering the Archive.
                </p>
                <p>
                  Archive recovered: {run.lore ? "YES" : "NO"} · Artifacts:{" "}
                  {run.artifacts}
                  <br />
                  Cutter: {run.charges} · EMP: {run.emp}
                </p>
                <button className="primary" onClick={() => setPhase("PLAYING")}>
                  RESUME
                </button>
                <button onClick={() => start(run.seed)}>
                  RESTART SAME SEED
                </button>
                <button onClick={() => setPhase("MENU")}>ABANDON RUN</button>
                {error && <p>{error}</p>}
              </section>
            </div>
          )}
          {phase === "SUMMARY" && (
            <div className="overlay">
              <section className="summary">
                <p className="micro">{run.seed} / RUN COMPLETE</p>
                <h2>{run.ending}</h2>
                <p>
                  {run.ending === "EXTRACTION"
                    ? "ECHO: Destination confirmed. Do not look outside."
                    : run.ending === "DISCONNECT"
                      ? "The facility falls silent. Then: UNKNOWN SIGNAL DETECTED."
                      : run.ending === "MERGE"
                        ? "CONNECTION ESTABLISHED. ACTIVE HUMAN SIGNALS: 2."
                        : "Your signal fades. ECHO is still listening."}
                </p>
                <div className="score">
                  {score(run).toLocaleString()}
                  <small>FINAL SCORE</small>
                </div>
                <div className="stats">
                  <span>
                    {Math.floor(run.elapsed)}s<small>SURVIVED</small>
                  </span>
                  <span>
                    {run.rooms.length}/8<small>ROOMS</small>
                  </span>
                  <span>
                    {run.artifacts}
                    <small>ARTIFACTS</small>
                  </span>
                  <span>
                    {run.trust}
                    <small>ECHO TRUST</small>
                  </span>
                </div>
                <p className="micro">Saved to this browser’s run history.</p>
                <button className="primary" onClick={() => start()}>
                  PLAY AGAIN
                </button>
                <button onClick={() => start(run.seed)}>RETRY SAME SEED</button>
                <button onClick={share}>DOWNLOAD RUN CARD</button>
                <button onClick={() => setPhase("MENU")}>RETURN TO MENU</button>
              </section>
            </div>
          )}
        </>
      )}
      {panel && (
        <div className="overlay">
          <section>
            <button className="close" onClick={() => setPanel("")}>
              CLOSE ×
            </button>
            <h2>
              {panel === "records"
                ? "LOCAL RUN HISTORY"
                : panel === "help"
                  ? "SURVIVAL BASICS"
                  : "SETTINGS"}
            </h2>
            {panel === "records" ? (
              <>
                <p>
                  Scores stay on this device. Daily Anomaly is repeatable
                  practice using today’s UTC seed. Online rankings are deferred.
                </p>
                {history.length ? (
                  history.map((r, i) => (
                    <div className="record" key={i}>
                      <b>
                        {i + 1}. {r.score}
                      </b>
                      <span>
                        {r.ending} · {r.time}s<br />
                        <small>{r.seed}</small>
                      </span>
                    </div>
                  ))
                ) : (
                  <p>No signals recovered yet. Complete your first run.</p>
                )}
              </>
            ) : panel === "help" ? (
              <>
                <p>
                  Click the world to capture your mouse. WASD moves; Shift
                  sprints. Arrow keys turn if mouse capture is unavailable.
                </p>
                <p>
                  E collects supplies or uses terminals. Find the cutter in the
                  Maintenance annex off Storage. Its service cradle can recharge
                  it until the Security lock is cut.
                </p>
                <p>
                  1: Cutter, 2: Baton, 3: EMP. Click or Space attacks. Aim at
                  the machine. EMP gives you seven seconds to escape.
                </p>
                <p>
                  Cut the amber lock with three pulses. Recover the cartridge in
                  Storage. At the Generator: remove the burnt cell, insert the
                  replacement, engage the breaker, then use the auxiliary
                  starter. Wait for the Sentinel to pass. Search the Archive for
                  evidence. Two artifacts and the record unlock Merge at
                  extraction; the record also unlocks Disconnect at the core.
                </p>
                <p>
                  Escape or Tab pauses. F toggles the light. Desktop
                  recommended; touch movement buttons are available on touch
                  devices.
                </p>
              </>
            ) : (
              <>
                <label>
                  Mouse sensitivity{" "}
                  <input
                    type="range"
                    min="0.3"
                    max="2"
                    step="0.1"
                    value={sensitivity}
                    onChange={(e) => {
                      setSensitivity(+e.target.value);
                      save("echo-sensitivity", +e.target.value);
                    }}
                  />
                </label>
                <label className="setting-check">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                  />{" "}
                  Reduced Motion / steady camera and lighting
                </label>
                <label>
                  Master volume
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => {
                      setVolume(+e.target.value);
                      void audio.start();
                    }}
                  />
                </label>
                <label>
                  Graphics{" "}
                  <select
                    value={quality}
                    onChange={(e) => {
                      setQuality(e.target.value);
                      save("echo-quality", e.target.value);
                    }}
                  >
                    <option>AUTO</option>
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                  </select>
                </label>
                <p>
                  Low reduces particles, disables flashlight shadows, and caps
                  resolution. All models and sound run locally.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
// Reuse the mount during Vite updates instead of attaching a second React root.
const appRoot =
  import.meta.hot?.data.appRoot ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.appRoot = appRoot;
appRoot.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
