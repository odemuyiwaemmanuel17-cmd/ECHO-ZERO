import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun, interact, attack, move, tick, finish } from "./game";

test("first run acquires its tool, cuts a real barrier, starts power in stages, and extracts", () => {
  const r = createRun("first-run");
  assert.equal(r.hasCutter, false);
  assert.equal(attack(r, Math.PI), false);
  tick(r, 4.1);
  assert.equal(r.message, "ECHO: Can you hear me?");
  r.contact = true;
  function walk(x: number, z: number) {
    for (let n = 0; Math.hypot(x - r.x, z - r.z) > 0.07; n++) {
      assert.ok(n < 3000, `blocked at ${r.x},${r.z}`);
      const d = Math.hypot(x - r.x, z - r.z),
        s = Math.min(0.06, d);
      move(r, ((x - r.x) / d) * s, ((z - r.z) / d) * s);
      tick(r, 0.02);
      const e = r.enemies.find(
        (e) => e.active && e.hp > 0 && Math.hypot(e.x - r.x, e.z - r.z) < 8,
      );
      if (e && r.hasCutter) attack(r, Math.atan2(r.x - e.x, r.z - e.z));
    }
  }
  walk(0, 24);
  walk(8.8, 24);
  interact(r);
  assert.equal(r.hasCutter, true);
  assert.equal(r.charges, 14);
  assert.equal(r.enemies[0].active, false);
  walk(0, 24);
  walk(0, 29.1);
  move(r, 0, 0.5);
  assert.ok(r.z < 29.45);
  for (let i = 0; i < 3; i++) {
    tick(r, 0.41);
    attack(r, Math.PI);
    assert.equal(r.lockHP, 60 - i * 30);
  }
  tick(r, 0.1);
  assert.equal(r.enemies[0].active, true);
  walk(0, 24);
  walk(-3, 24);
  interact(r);
  assert.equal(r.fuse, true);
  walk(0, 24);
  walk(0, 49);
  for (let i = 0; i < 4; i++) {
    tick(r, 0.81);
    interact(r);
    assert.equal(r.powerStep, i + 1);
    assert.equal(r.power, i === 3);
  }
  assert.equal(r.sentinelEncounter, r.elapsed);
  tick(r, 6);
  assert.equal(r.message, "ECHO: Stop.");
  tick(r, 1.7);
  assert.equal(r.message, "ECHO: Do not move.");
  for (let i = 0; i < 140; i++) tick(r, 0.1);
  assert.equal(r.message, "ECHO: Now.");
  walk(0, 86);
  assert.equal(finish(r, "EXTRACTION"), true);
  assert.ok(r.health > 0);
});

test("power cannot skip a replacement, double activation or a failed first start", () => {
  const r = createRun("power");
  r.z = 49;
  interact(r);
  assert.equal(r.powerStep, 1);
  r.fuse = true;
  interact(r);
  assert.equal(r.powerStep, 1);
  tick(r, 0.81);
  interact(r);
  assert.equal(r.powerStep, 2);
  assert.equal(r.fuse, false);
  tick(r, 0.81);
  interact(r);
  assert.equal(r.powerStep, 3);
  assert.equal(r.power, false);
  tick(r, 0.81);
  interact(r);
  assert.equal(r.power, true);
});
