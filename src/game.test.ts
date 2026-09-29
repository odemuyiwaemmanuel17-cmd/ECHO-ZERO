import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  attack,
  seesPlayer,
  canMove,
  createRun as freshRun,
  finish,
  hurt,
  interact as useObject,
  move,
  roomAt,
  score,
  tick,
} from "./game";

// Existing subsystem tests start after the acquisition/tutorial checkpoint.
function createRun(seed: string) {
  const r = freshRun(seed);
  Object.assign(r, {
    hasCutter: true,
    weapon: 1,
    charges: 14,
    lockHP: 0,
    contact: true,
  });
  r.enemies[0].active = true;
  return r;
}
function interact(r: ReturnType<typeof freshRun>) {
  r.elapsed += 0.81;
  useObject(r);
  if (r.z >= 47 && r.z <= 51 && Math.abs(r.x) < 2.3) {
    for (let i = 0; i < 3; i++) {
      r.elapsed += 0.81;
      useObject(r);
    }
  }
}

test("presentation GLB contains every required model and stays compact", () => {
  const bytes = readFileSync(
    new URL("../public/models/facility.glb", import.meta.url),
  );
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.ok(bytes.length < 2 * 1024 * 1024);
  const length = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + length));
  const names = new Set(gltf.nodes.map((n: { name?: string }) => n.name));
  for (const name of [
    "pod",
    "podLid",
    "terminal",
    "crate",
    "rack",
    "bed",
    "turbine",
    "rotor",
    "cell",
    "fuse",
    "medkit",
    "artifact",
    "log",
    "drone",
    "sentinel",
    "shade",
    "cutter",
    "baton",
    "emp",
    "hand",
  ])
    assert.ok(names.has(name), `missing model ${name}`);
});
test("annexes are accessible but cannot bypass the powered gate or facility bounds", () => {
  const r = createRun("annex");
  r.z = 24;
  for (let i = 0; i < 90; i++) move(r, 0.1, 0);
  assert.ok(r.x > 8.9);
  assert.equal(canMove(11, 24, false), false);
  assert.equal(canMove(8, 27, false), false);
  for (let i = 0; i < 90; i++) move(r, -0.1, 0);
  assert.ok(Math.abs(r.x) < 0.001);
  assert.equal(canMove(-8, 84, true), true);
  assert.equal(canMove(-8, 54, false), false);
});
test("post-power Sentinel sequence preserves control and lets a hidden player pass", () => {
  const r = createRun("crossing");
  r.z = 36;
  move(r, 0, 0.1);
  assert.equal(r.sentinelEncounter, null);
  const e = r.enemies[1];
  assert.equal(e.active, false);
  r.z = 47;
  r.fuse = true;
  interact(r);
  assert.equal(r.power, true);
  assert.match(r.message, /We need to move/);
  tick(r, 6);
  assert.equal(r.message, "ECHO: Stop.");
  tick(r, 1.7);
  assert.equal(r.message, "ECHO: Do not move.");
  tick(r, 1.4);
  assert.equal(e.active, true);
  move(r, 0.2, 0);
  assert.equal(r.x, 0.2);
  for (let i = 0; i < 121; i++) tick(r, 0.1);
  assert.equal(r.message, "ECHO: Now.");
  assert.equal(r.health, 100);
});
test("scanning detects only within the cone and walls block it; drones investigate noise", () => {
  const r = createRun("scan"),
    e = r.enemies[0];
  e.x = 0;
  e.z = 24;
  e.yaw = Math.PI;
  r.x = 0;
  r.z = 20;
  assert.equal(seesPlayer(r, e), true);
  r.x = 3;
  r.z = 24;
  assert.equal(seesPlayer(r, e), false);
  r.x = 3;
  r.z = 16;
  assert.equal(seesPlayer(r, e), false);
  r.x = 3;
  r.z = 25;
  r.noiseAt = 0;
  r.noiseX = 3;
  r.noiseZ = 25;
  tick(r, 0.1);
  assert.equal(e.state, "investigate");
  e.stunned = 5;
  assert.equal(seesPlayer(r, e), false);
});

test("active-enemy playthroughs reach every ending across multiple seeds", () => {
  for (const seed of ["ECHO-7", "DAILY-2026-09-21", "replay"]) {
    for (const ending of ["EXTRACTION", "DISCONNECT", "MERGE"] as const) {
      const r = createRun(seed);
      let cooldown = 0;
      function walk(x: number, z: number) {
        let steps = 0;
        while (Math.hypot(x - r.x, z - r.z) > 0.08) {
          assert.ok(++steps < 6000, "route must not get stuck on a wall");
          assert.equal(r.ending, null, "player must survive this route");
          const dt = 1 / 30;
          cooldown -= dt;
          const enemy = r.enemies.find(
            (e) =>
              e.hp > 0 &&
              e.active &&
              roomAt(e.z) === roomAt(r.z) &&
              Math.hypot(e.x - r.x, e.z - r.z) < 10,
          );
          if (enemy && cooldown <= 0) {
            attack(r, Math.atan2(-(enemy.x - r.x), -(enemy.z - r.z)));
            cooldown = 0.45;
          }
          const distance = Math.hypot(x - r.x, z - r.z);
          const step = Math.min(distance, 3.3 * dt);
          move(r, ((x - r.x) / distance) * step, ((z - r.z) / distance) * step);
          tick(r, dt);
        }
      }
      walk(0, 24);
      walk(-3, 24);
      interact(r);
      walk(0, 24);
      // Recover each optional artifact without teleporting or bypassing the gate.
      for (const room of [2, 4]) {
        walk(0, room * 12 + 2);
        const artifact = r.items.find(
          (i) => i.kind === "artifact" && roomAt(i.z) === room,
        )!;
        walk(artifact.x, artifact.z);
        interact(r);
        walk(0, artifact.z);
      }
      walk(0, 49);
      interact(r);
      assert.equal(r.power, true);
      walk(0, 60);
      walk(-3, 60);
      interact(r);
      assert.equal(r.lore, true);
      walk(0, 60);
      if (ending === "DISCONNECT") {
        walk(0, 72);
        walk(-3, 72);
      } else walk(0, 86);
      assert.equal(finish(r, ending), true);
      assert.equal(r.ending, ending);
      assert.ok(r.kills >= 2);
      assert.ok(r.health > 0);
      assert.ok(score(r) > 3000);
    }
  }
});
test("seed recreates loot and enemy placement", () => {
  assert.deepEqual(createRun("daily"), createRun("daily"));
  assert.notDeepEqual(createRun("a").enemies, createRun("b").enemies);
});
test("walls, doorway and powered security gate enforce collision", () => {
  assert.equal(canMove(5, 0, true), false);
  assert.equal(canMove(3, 6, true), false);
  assert.equal(canMove(0, 6, false), true);
  assert.equal(canMove(0, 54, false), false);
  assert.equal(canMove(0, 54, true), true);
  const r = createRun("x");
  move(r, 20, 0);
  assert.equal(r.x, 0);
});
function powered() {
  const r = createRun("x");
  r.x = 0;
  r.z = 49;
  interact(r);
  assert.equal(r.power, false);
  r.x = -3;
  r.z = 24;
  interact(r);
  assert.equal(r.fuse, true);
  interact(r);
  r.x = 0;
  r.z = 49;
  interact(r);
  assert.equal(r.power, true);
  assert.equal(r.fuse, false);
  return r;
}
test("fuse to power to extraction completes and scores a run", () => {
  const r = powered();
  r.x = 0;
  r.z = 86;
  assert.equal(finish(r, "EXTRACTION"), true);
  assert.ok(score(r) >= 2450);
});
test("endings require location, evidence and artifacts", () => {
  const r = powered();
  assert.equal(finish(r, "DISCONNECT"), false);
  r.x = -3;
  r.z = 60;
  interact(r);
  assert.equal(r.lore, true);
  r.x = -3;
  r.z = 72;
  assert.equal(finish(r, "DISCONNECT"), true);
  const m = powered();
  m.x = 0;
  m.z = 86;
  assert.equal(finish(m, "MERGE"), false);
  m.lore = true;
  m.artifacts = 2;
  assert.equal(finish(m, "MERGE"), true);
});
test("combat consumes charges and aim matters; EMP suspends damage", () => {
  const r = createRun("x");
  r.enemies = [{ ...r.enemies[0], x: 0, z: 2, hp: 45 }];
  attack(r, Math.PI);
  assert.equal(r.charges, 13);
  assert.equal(r.enemies[0].hp, 15);
  r.elapsed += 0.41;
  attack(r, 0);
  assert.equal(r.enemies[0].hp, 15);
  r.weapon = 3;
  r.elapsed += 0.41;
  attack(r, 0);
  r.enemies[0].z = 0.5;
  tick(r, 1);
  assert.equal(r.health, 100);
  assert.equal(r.emp, 1);
});
test("enemy damage causes death; restart resets state", () => {
  const r = createRun("x");
  r.enemies = [{ ...r.enemies[0], x: 0, z: 0.5, cooldown: 0 }];
  tick(r, 0.1);
  assert.equal(r.health, 90);
  hurt(r, 100);
  assert.equal(r.ending, "SIGNAL LOST");
  const time = r.elapsed;
  tick(r, 10);
  assert.equal(r.elapsed, time);
  assert.equal(createRun(r.seed).health, 100);
});
test("supplies are single-use and energy/stamina stay bounded", () => {
  const r = createRun("x");
  r.health = 40;
  r.x = 3;
  r.z = 12;
  interact(r);
  assert.equal(r.health, 85);
  interact(r);
  assert.equal(r.health, 85);
  r.energy = 0.01;
  tick(r, 1);
  assert.equal(r.energy, 0);
  assert.equal(r.flashlight, false);
  tick(r, 100, true);
  assert.equal(r.stamina, 0);
});
test("a physical route reaches every room without crossing walls", () => {
  const r = powered();
  r.x = 0;
  r.z = 0;
  for (let i = 0; i < 860; i++) move(r, 0, 0.1);
  assert.equal(r.rooms.length, 8);
  assert.ok(r.z > 85);
  assert.equal(finish(r, "EXTRACTION"), true);
});
import { facilityEvent } from "./atmosphere";
test("atmospheric events are deterministic, sparse, and suppressed during the encounter", () => {
  const a = createRun("events"),
    b = createRun("events");
  let active = 0,
    quiet = 0;
  for (let t = 0; t < 256; t += 0.2) {
    a.elapsed = b.elapsed = t;
    const event = facilityEvent(a);
    assert.deepEqual(event, facilityEvent(b));
    if (event) active++;
    else quiet++;
  }
  assert.ok(active > 0);
  assert.ok(quiet > active * 5);
  a.sentinelEncounter = a.elapsed;
  assert.equal(facilityEvent(a), null);
});
test("Sentinel notices exposure while EMP buys time without removing player control", () => {
  const r = createRun("exposure");
  r.fuse = true;
  r.z = 47;
  interact(r);
  tick(r, 9.1);
  const e = r.enemies[1];
  r.z = 53;
  r.x = 0;
  for (let n = 0; n < 60; n++) tick(r, 0.05);
  assert.ok(e.alert >= 1);
  assert.equal(e.state, "chase");
  r.weapon = 3;
  attack(r, 0);
  assert.equal(e.stunned, 7);
  const hp = r.health;
  tick(r, 1);
  assert.equal(r.health, hp);
  const z = r.z;
  move(r, 0, -0.2);
  assert.ok(r.z < z);
});
