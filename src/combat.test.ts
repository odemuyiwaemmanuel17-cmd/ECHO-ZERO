import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun as freshRun, attack, tick } from "./game";
import { fireAllowed } from "./combat";
import { bindPrimaryInput } from "./primary-input";
function createRun(seed: string) {
  const r = freshRun(seed);
  Object.assign(r, { hasCutter: true, weapon: 1, charges: 10, contact: true });
  r.enemies[0].active = true;
  return r;
}

test("camera ray respects vertical aim, walls, nearest target, ammo, energy and death", () => {
  const r = createRun("combat");
  r.enemies = [{ ...r.enemies[0], x: 0, z: 4, stunned: 999 }];
  attack(r, Math.PI, 0.8);
  assert.equal(r.enemies[0].hp, 45);
  r.elapsed += 0.41;
  attack(r, Math.PI, 0, { kind: "metal", distance: 2, point: [0, 1.65, 2] });
  assert.equal(r.enemies[0].hp, 45);
  assert.equal(r.shot?.hit?.kind, "metal");
  r.elapsed += 0.41;
  attack(r, Math.PI);
  assert.equal(r.enemies[0].hp, 15);
  assert.equal(r.shot?.hit?.kind, "enemy");
  const shots = r.shot!.serial;
  for (let i = 0; i < 20; i++) attack(r, Math.PI);
  assert.equal(r.shot!.serial, shots);
  r.elapsed += 0.41;
  attack(r, Math.PI);
  assert.equal(r.enemies[0].hp, 0);
  assert.equal(r.kills, 1);
  assert.equal(r.charges, 6);
  assert.equal(r.energy, 76);
  r.elapsed += 0.41;
  r.energy = 0;
  assert.equal(attack(r, Math.PI), undefined);
  assert.equal(r.charges, 6);
});
test("fire eligibility blocks menus, death, dialogue and cooldown, then recovers", () => {
  const r = createRun("eligibility");
  assert.equal(fireAllowed("PAUSED", r, false), false);
  assert.equal(fireAllowed("PLAYING", r, true), false);
  attack(r, Math.PI);
  assert.equal(fireAllowed("PLAYING", r, false), false);
  tick(r, 0.41);
  assert.equal(fireAllowed("PLAYING", r, false), true);
  r.ending = "SIGNAL LOST";
  assert.equal(fireAllowed("PLAYING", r, false), false);
});
test("native pointer path acquires once, repeats, ignores UI and cleans up on release/unmount", () => {
  class FakeDocument extends EventTarget {
    pointerLockElement: unknown = null;
  }
  const doc = new FakeDocument(),
    win = new EventTarget();
  const previousDoc = globalThis.document,
    previousWin = globalThis.window;
  Object.assign(globalThis, { document: doc, window: win });
  let presses = 0,
    releases = 0,
    observed = 0,
    playing = true,
    blocked = false;
  const canvas = {
    requestPointerLock: () => {
      doc.pointerLockElement = canvas;
      return Promise.resolve();
    },
  };
  const down = (target: unknown, button = 0) => {
    const event = new Event("pointerdown");
    Object.defineProperties(event, {
      target: { value: target },
      button: { value: button },
      pointerType: { value: "mouse" },
    });
    doc.dispatchEvent(event);
  };
  try {
    const dispose = bindPrimaryInput(canvas as HTMLCanvasElement, {
      playing: () => playing,
      blocked: () => blocked,
      press: () => presses++,
      release: () => releases++,
      captureError: () => assert.fail(),
      unlockedFire: () => false,
      observed: () => observed++,
    });
    down({});
    assert.equal(observed, 0);
    down(canvas);
    assert.equal(presses, 0);
    down(canvas);
    assert.equal(presses, 1);
    down(canvas);
    assert.equal(presses, 2);
    down(canvas, 2);
    assert.equal(presses, 2);
    doc.dispatchEvent(new Event("pointerup"));
    assert.equal(releases, 1);
    playing = false;
    down(canvas);
    assert.equal(presses, 2);
    playing = true;
    blocked = true;
    down(canvas);
    assert.equal(presses, 2);
    blocked = false;
    doc.pointerLockElement = null;
    down(canvas);
    assert.equal(presses, 2);
    down(canvas);
    assert.equal(presses, 3);
    win.dispatchEvent(new Event("blur"));
    assert.equal(releases, 2);
    dispose();
    down(canvas);
    assert.equal(presses, 3);
  } finally {
    Object.assign(globalThis, { document: previousDoc, window: previousWin });
  }
});
