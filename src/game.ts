import { encounterStage } from "./atmosphere";
import { chamberBlocked } from "./containment-collision";
import {
  aimRay,
  traceShot,
  FIRE_INTERVAL,
  CUTTER_RANGE,
  type Hit,
  type Shot,
} from "./combat";
export type Item = "fuse" | "cell" | "medkit" | "artifact" | "log" | "cutter";
export type Ending = "EXTRACTION" | "DISCONNECT" | "MERGE" | "SIGNAL LOST";
export type Entity = {
  id: number;
  kind: Item;
  x: number;
  z: number;
  taken: boolean;
};
export type Enemy = {
  id: number;
  type: "DRONE" | "SENTINEL" | "SHADE";
  x: number;
  z: number;
  home: number;
  active: boolean;
  yaw: number;
  alert: number;
  hp: number;
  cooldown: number;
  stunned: number;
  hitAt: number;
  lastSeenAt: number;
  lastSeenX: number;
  lastSeenZ: number;
  state:
    | "patrol"
    | "chase"
    | "attack"
    | "return"
    | "investigate"
    | "search"
    | "scan";
};
export type Run = {
  seed: string;
  x: number;
  z: number;
  health: number;
  energy: number;
  stamina: number;
  charges: number;
  emp: number;
  fuse: boolean;
  power: boolean;
  artifacts: number;
  lore: boolean;
  trust: number;
  elapsed: number;
  damage: number;
  kills: number;
  rooms: number[];
  items: Entity[];
  enemies: Enemy[];
  ending: Ending | null;
  message: string;
  weapon: number;
  flashlight: boolean;
  sentinelEncounter: number | null;
  noiseAt: number;
  noiseX: number;
  noiseZ: number;
  interactionAt: number;
  interactionKind: string;
  fireReadyAt: number;
  shot: Shot | null;
  hasCutter: boolean;
  lockHP: number;
  cutterAt: number | null;
  contact: boolean;
  powerStep: number;
};
export const roomNames = [
  "Containment chamber",
  "Medical bay",
  "Storage area",
  "Security corridor",
  "Generator room",
  "Research / Archive",
  "Server core",
  "Extraction chamber",
];
export const roomAt = (z: number) =>
  Math.max(0, Math.min(7, Math.floor((z + 6) / 12)));
export function rng(seed: string) {
  let a = 2166136261;
  for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function createRun(seed: string): Run {
  const random = rng(seed);
  return {
    seed,
    x: 0,
    z: 0,
    health: 100,
    energy: 80,
    stamina: 100,
    charges: 0,
    emp: 2,
    fuse: false,
    power: false,
    artifacts: 0,
    lore: false,
    trust: 0,
    elapsed: 0,
    damage: 0,
    kills: 0,
    rooms: [0],
    ending: null,
    message: "CONTAINMENT RELEASE / RESPIRATION DETECTED",
    weapon: 0,
    flashlight: true,
    sentinelEncounter: null,
    noiseAt: -100,
    noiseX: 0,
    noiseZ: 0,
    interactionAt: -100,
    interactionKind: "",
    fireReadyAt: 0,
    shot: null,
    hasCutter: false,
    lockHP: 90,
    cutterAt: null,
    contact: false,
    powerStep: 0,
    items: [
      { id: 7, kind: "cutter", x: 8.8, z: 24, taken: false },
      { id: 0, kind: "fuse", x: -3, z: 24, taken: false },
      { id: 1, kind: "medkit", x: 3, z: 12, taken: false },
      { id: 2, kind: "cell", x: -3, z: 13, taken: false },
      { id: 3, kind: "log", x: -3, z: 60, taken: false },
      ...[2, 4, 5].map((r, i) => ({
        id: 4 + i,
        kind: "artifact" as Item,
        x: random() > 0.5 ? 3 : -3,
        z: r * 12 + 2,
        taken: false,
      })),
    ],
    enemies: [2, 3, 5].map((r, i) => ({
      id: i,
      type: (["DRONE", "SENTINEL", "SHADE"] as const)[i],
      x: 2 + random(),
      z: i === 0 ? 36 : i === 1 ? 57 : r * 12 + 3,
      home: i === 0 ? 36 : i === 1 ? 57 : r * 12 + 3,
      active: i === 2,
      yaw: Math.PI,
      alert: 0,
      hp: [45, 110, 65][i],
      cooldown: 1,
      stunned: 0,
      hitAt: -100,
      lastSeenAt: -100,
      lastSeenX: 0,
      lastSeenZ: 0,
      state: "patrol",
    })),
  };
}
export function canMove(x: number, z: number, power: boolean, lockHP = 0) {
  if (chamberBlocked(x, z)) return false;
  // Two small side annexes; the original eight-room route and gate stay intact.
  if (x > 4.55 && x < 10.55 && z > 22.45 && z < 25.55) return true;
  if (x < -4.55 && x > -10.55 && z > 82.45 && z < 85.55) return true;
  if (Math.abs(x) > 4.55 || z < -5.5 || z > 89.4) return false;
  for (let i = 0; i < 7; i++) {
    const boundary = i * 12 + 6;
    if (
      Math.abs(z - boundary) < 0.55 &&
      (Math.abs(x) > 1.3 || (i === 4 && !power) || (i === 2 && lockHP > 0))
    )
      return false;
  }
  return true;
}
export function move(r: Run, dx: number, dz: number) {
  if (canMove(r.x + dx, r.z, r.power, r.lockHP)) r.x += dx;
  if (canMove(r.x, r.z + dz, r.power, r.lockHP)) r.z += dz;
  const room = roomAt(r.z);
  if (!r.rooms.includes(room)) {
    r.rooms.push(room);
    if (["dormant", "clear"].includes(encounterStage(r)))
      r.message =
        room === 5
          ? "ECHO: Archive records are damaged. There is nothing useful here."
          : `ECHO: ${roomNames[room]}. Keep moving.`;
  }
}
export function target(
  r: Run,
):
  | Entity
  | { kind: "generator" | "exit" | "core" | "charger"; x: number; z: number }
  | undefined {
  const things = [
    ...r.items.filter((i) => !i.taken),
    ...(r.hasCutter && r.lockHP > 0
      ? [{ kind: "charger" as const, x: 8.8, z: 24 }]
      : []),
    { kind: "generator" as const, x: 0, z: 49 },
    { kind: "core" as const, x: -3, z: 72 },
    { kind: "exit" as const, x: 0, z: 86 },
  ];
  return things.find((i) => Math.hypot(i.x - r.x, i.z - r.z) < 2.3);
}
export function interact(r: Run) {
  if (r.ending || r.elapsed - r.interactionAt < 0.8) return;
  const t = target(r);
  if (!t) return;
  r.interactionAt = r.elapsed;
  r.interactionKind = t.kind;
  if (t.kind === "charger") {
    r.charges = Math.max(r.charges, 6);
    r.energy = Math.max(r.energy, 20);
    r.message =
      "SERVICE CHARGE RESTORED — cut the amber lock on the Security door.";
    return;
  }
  if (t.kind === "generator") {
    if (r.power) {
      r.message = "ECHO: Emergency power is online. The archive door is open.";
      return;
    }
    if (r.powerStep === 0) {
      r.powerStep = 1;
      r.message = "BURNT CARTRIDGE REMOVED — replacement socket exposed.";
      return;
    }
    if (r.powerStep === 1 && !r.fuse) {
      r.message = "FUSE REQUIRED — search Storage.";
      return;
    }
    if (r.powerStep === 1) {
      r.fuse = false;
      r.powerStep = 2;
      r.message = "REPLACEMENT SEATED — engage the manual breaker.";
      return;
    }
    if (r.powerStep === 2) {
      r.powerStep = 3;
      r.message = "START FAILED / PRESSURE LOW — engage the auxiliary starter.";
      return;
    }
    r.powerStep = 4;
    r.power = true;
    r.sentinelEncounter = r.elapsed;
    r.message = "ECHO: Power restored. We need to move.";
    return;
  }
  if (t.kind === "core") {
    r.message = r.lore
      ? "CORE ACCESS GRANTED — choose Disconnect, or continue to Extraction."
      : "CORE LOCKED — recover the archive record first.";
    return;
  }
  if (t.kind === "exit") {
    r.message = r.power
      ? "EXTRACTION READY — choose your final connection."
      : "Restore emergency power first.";
    return;
  }
  const item = t as Entity;
  item.taken = true;
  if (item.kind === "cutter") {
    r.hasCutter = true;
    r.weapon = 1;
    r.charges += 14;
    r.energy = Math.max(r.energy, 30);
    r.cutterAt = r.elapsed;
    r.message = "ECHO: That was not designed as a weapon.";
    return;
  }
  if (item.kind === "fuse") r.fuse = true;
  if (item.kind === "medkit") r.health = Math.min(100, r.health + 45);
  if (item.kind === "cell") {
    r.energy = Math.min(100, r.energy + 40);
    r.charges += 6;
  }
  if (item.kind === "artifact") r.artifacts++;
  if (item.kind === "log") {
    r.lore = true;
    r.trust -= 25;
  }
  r.message =
    item.kind === "log"
      ? "ARCHIVE 019: “The evacuation was cancelled by ECHO. Human signals were reclassified, not lost.” ECHO: That record lacks context."
      : `${item.kind.toUpperCase()} RECOVERED${item.kind === "medkit" ? " — health restored" : item.kind === "cell" ? " — energy and cutter charges restored" : ""}.`;
}
export function hurt(r: Run, amount: number) {
  r.health = Math.max(0, r.health - amount);
  r.damage += amount;
  if (r.health === 0) r.ending = "SIGNAL LOST";
}
export function tick(r: Run, dt: number, sprinting = false) {
  if (r.ending) return;
  const before = encounterStage(r);
  const previousTime = r.elapsed;
  r.elapsed += dt;
  if (previousTime < 4 && r.elapsed >= 4 && !r.contact)
    r.message = "ECHO: Can you hear me?";
  if (
    r.cutterAt !== null &&
    previousTime < r.cutterAt + 4 &&
    r.elapsed >= r.cutterAt + 4
  )
    r.message = "ECHO: But neither were they.";
  if (
    r.cutterAt !== null &&
    previousTime < r.cutterAt + 8 &&
    r.elapsed >= r.cutterAt + 8 &&
    r.lockHP > 0
  )
    r.message =
      "ECHO: The cutter may still function. Cut the damaged lock on the Security door.";
  const stage = encounterStage(r);
  if (stage !== before) {
    if (stage === "stop") r.message = "ECHO: Stop.";
    if (stage === "warning") r.message = "ECHO: Do not move.";
    if (stage === "clear") r.message = "ECHO: Now.";
  }
  if (sprinting) {
    r.noiseAt = r.elapsed;
    r.noiseX = r.x;
    r.noiseZ = r.z;
  }
  r.stamina = Math.max(
    0,
    Math.min(100, r.stamina + (sprinting ? -22 : 16) * dt),
  );
  r.energy = Math.max(0, r.energy - (r.flashlight ? 0.22 : 0) * dt);
  if (r.energy === 0) r.flashlight = false;
  for (const e of r.enemies) {
    if (e.type === "DRONE" && r.lockHP === 0) e.active = true;
    if (e.hp <= 0) continue;
    e.cooldown -= dt;
    e.stunned = Math.max(0, e.stunned - dt);
    if (e.stunned > 0) continue;
    if (e.type === "SENTINEL") {
      if (!e.active && ["crossing", "clear"].includes(stage)) e.active = true;
      if (!e.active) continue;
      if (stage === "clear" && e.alert < 1 && roomAt(r.z) < 5) {
        e.x = Math.max(-3.8, e.x - dt * 0.47);
        e.yaw = -Math.PI / 2;
        e.state = "patrol";
        continue;
      }
      if (stage === "crossing" && e.alert < 1) {
        const age = r.elapsed - r.sentinelEncounter! - 9;
        e.x = 2.8 - age * 0.47;
        e.z = 57;
        e.yaw = Math.PI + Math.sin(age * 0.7) * 0.65;
        // The recessed generator controls are safe; stepping into the junction is exposed.
        const exposed =
          Math.hypot(e.x - r.x, e.z - r.z) < 7 && seesPlayer(r, e);
        e.alert = Math.max(0, e.alert + (exposed ? dt : -dt * 0.5));
        e.state = "patrol";
        continue;
      }
    }
    if (!e.active) continue;
    const dist = Math.hypot(e.x - r.x, e.z - r.z);
    const sameRoom = roomAt(e.z) === roomAt(r.z);
    if (seesPlayer(r, e)) {
      e.alert = 1;
      e.lastSeenAt = r.elapsed;
      e.lastSeenX = r.x;
      e.lastSeenZ = r.z;
    }
    if (sameRoom && dist < 1.6) {
      e.state = "attack";
      if (e.cooldown <= 0) {
        hurt(r, e.type === "SENTINEL" ? 24 : 10);
        e.cooldown = e.type === "DRONE" ? 1 : 1.6;
        r.message = `WARNING: ${e.type} attacking. Fire, use EMP, or retreat.`;
      }
    } else if (
      dist < 9 &&
      (e.type === "SHADE"
        ? sameRoom
        : e.alert >= 1 && lineOfSight(r, e.x, e.z, r.x, r.z))
    ) {
      e.yaw = Math.atan2(r.x - e.x, r.z - e.z);
      e.state = "chase";
      const speed =
        e.type === "SENTINEL" ? 0.85 : e.type === "SHADE" ? 1.65 : 1.4;
      const dx = ((r.x - e.x) / dist) * speed * dt,
        dz = ((r.z - e.z) / dist) * speed * dt;
      if (canMove(e.x + dx, e.z + dz, r.power, r.lockHP)) {
        e.x += dx;
        e.z += dz;
      }
    } else if (e.type === "DRONE" && r.elapsed - e.lastSeenAt < 6) {
      e.state = "search";
      const d = Math.hypot(e.lastSeenX - e.x, e.lastSeenZ - e.z);
      if (d > 0.3) {
        e.yaw = Math.atan2(e.lastSeenX - e.x, e.lastSeenZ - e.z);
        const nx = e.x + Math.sin(e.yaw) * dt,
          nz = e.z + Math.cos(e.yaw) * dt;
        if (canMove(nx, nz, r.power, r.lockHP)) {
          e.x = nx;
          e.z = nz;
        }
      } else e.yaw += dt * 0.8;
    } else if (
      e.type === "DRONE" &&
      r.elapsed - r.noiseAt < 5 &&
      Math.hypot(e.x - r.noiseX, e.z - r.noiseZ) < 12
    ) {
      e.state = "investigate";
      e.yaw = Math.atan2(r.noiseX - e.x, r.noiseZ - e.z);
      const nx = e.x + Math.sin(e.yaw) * dt * 1.8,
        nz = e.z + Math.cos(e.yaw) * dt * 1.8;
      if (
        canMove(nx, nz, r.power, r.lockHP) &&
        Math.hypot(e.x - r.noiseX, e.z - r.noiseZ) > 0.3
      ) {
        e.x = nx;
        e.z = nz;
      }
    } else {
      e.alert = 0;
      e.yaw = Math.PI + Math.sin(r.elapsed * 0.45 + e.id) * 0.9;
      e.state = "return";
      const dz = e.home - e.z;
      if (
        Math.abs(dz) > 0.2 &&
        canMove(e.x, e.z + Math.sign(dz) * dt, r.power, r.lockHP)
      )
        e.z += Math.sign(dz) * dt;
      else {
        const pause = r.elapsed % 9 > 6;
        e.state = pause ? "scan" : "patrol";
        const desired = Math.sin(r.elapsed * 0.35 + e.id) * 2.5;
        if (!pause)
          e.x += Math.max(-dt * 0.8, Math.min(dt * 0.8, desired - e.x));
      }
    }
  }
}
export function attack(
  r: Run,
  yaw: number,
  pitch = 0,
  surface?: Hit | null,
  originY = 1.65,
) {
  if (
    !r.hasCutter ||
    r.ending ||
    r.elapsed < r.fireReadyAt ||
    ![1, 2, 3].includes(r.weapon)
  )
    return false;
  if (r.weapon === 3) {
    if (!r.emp) {
      r.message = "No EMP charges remaining.";
      return;
    }
    r.emp--;
    r.fireReadyAt = r.elapsed + FIRE_INTERVAL;
    r.shot = {
      serial: (r.shot?.serial ?? 0) + 1,
      at: r.elapsed,
      weapon: 3,
      origin: [r.x, originY, r.z],
      hit: null,
    };
    r.enemies
      .filter((e) => Math.hypot(e.x - r.x, e.z - r.z) < 8)
      .forEach((e) => (e.stunned = 7));
    r.message = "EMP DISCHARGED — nearby machines disabled for 7 seconds.";
    return true;
  }
  if (r.weapon === 1 && (r.charges <= 0 || r.energy < 1)) {
    r.message =
      r.charges <= 0
        ? "Cutter empty. Switch to baton [2] or recover an energy cell."
        : "Cutter energy depleted. Recover an energy cell or use the baton [2].";
    return;
  }
  if (r.weapon === 2 && r.stamina < 20) {
    r.message = "Too exhausted. Let stamina recover.";
    return;
  }
  r.noiseAt = r.elapsed;
  r.noiseX = r.x;
  r.noiseZ = r.z;
  if (r.weapon === 1) {
    r.charges--;
    r.energy = Math.max(0, r.energy - 1);
  } else r.stamina -= 20;
  r.fireReadyAt = r.elapsed + FIRE_INTERVAL;
  const hit = traceShot(
    r,
    aimRay(r.x, originY, r.z, yaw, pitch),
    r.weapon === 1 ? CUTTER_RANGE : 2.6,
    surface,
  );
  r.shot = {
    serial: (r.shot?.serial ?? 0) + 1,
    at: r.elapsed,
    weapon: r.weapon,
    origin: [r.x, originY, r.z],
    hit,
  };
  if (hit?.kind === "lock" && r.weapon === 1) {
    r.lockHP = Math.max(0, r.lockHP - 30);
    r.message = r.lockHP
      ? `STRUCTURAL LOCK / ${r.lockHP / 30} CUTS REMAINING`
      : "ECHO: The passage is open. That drone is still on its old patrol.";
  }
  if (hit?.kind === "enemy") {
    const enemy = r.enemies.find((e) => e.id === hit.id)!;
    enemy.alert = 1;
    enemy.hitAt = r.elapsed;
    enemy.stunned = Math.max(
      enemy.stunned,
      enemy.type === "SENTINEL" ? 0.12 : 0.25,
    );
    enemy.hp = Math.max(0, enemy.hp - (r.weapon === 1 ? 30 : 24));
    if (enemy.hp === 0) r.kills++;
    r.message = `${enemy.type} ${enemy.hp === 0 ? "disabled" : "armor struck"}.`;
  }
  return true;
}
export function finish(r: Run, ending: Ending) {
  if (ending === "SIGNAL LOST") return false;
  if (!r.power) return false;
  if (ending === "DISCONNECT") {
    if (!r.lore || Math.hypot(r.x + 3, r.z - 72) > 2.3) return false;
  } else {
    if (Math.hypot(r.x, r.z - 86) > 2.3) return false;
    if (ending === "MERGE" && (!r.lore || r.artifacts < 2)) return false;
  }
  r.ending = ending;
  return true;
}
export function score(r: Run) {
  return Math.max(
    0,
    Math.round(
      r.rooms.length * 150 +
        r.artifacts * 600 +
        r.kills * 100 +
        (r.power ? 800 : 0) +
        (r.lore ? 400 : 0) +
        (r.ending && r.ending !== "SIGNAL LOST" ? 1500 : 0) +
        Math.min(r.elapsed, 600) * 2 +
        r.energy * 3 -
        r.damage * 5 -
        (r.ending === "SIGNAL LOST" ? 500 : 0),
    ),
  );
}
export function lineOfSight(
  r: Run,
  x: number,
  z: number,
  tx: number,
  tz: number,
) {
  const steps = Math.ceil(Math.hypot(tx - x, tz - z) / 0.2);
  for (let i = 1; i < steps; i++)
    if (
      !canMove(
        x + ((tx - x) * i) / steps,
        z + ((tz - z) * i) / steps,
        r.power,
        r.lockHP,
      )
    )
      return false;
  return true;
}
export function seesPlayer(r: Run, e: Enemy) {
  const dx = r.x - e.x,
    dz = r.z - e.z,
    d = Math.hypot(dx, dz);
  return (
    e.active &&
    e.stunned === 0 &&
    d < (e.type === "SENTINEL" ? 9 : 8) &&
    (d < 0.1 ||
      (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / d >
        Math.cos(e.type === "SENTINEL" ? 0.45 : 0.6)) &&
    lineOfSight(r, e.x, e.z, r.x, r.z)
  );
}
