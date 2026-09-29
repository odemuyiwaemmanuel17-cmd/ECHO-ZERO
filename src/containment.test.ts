import test from 'node:test';
import assert from 'node:assert/strict';
import { canMove, createRun, move } from './game';
import { readFileSync } from 'node:fs';

test('containment furnishings block traversal while spawn and exit aisle remain clear', () => {
  for (let z = 0; z <= 7; z += .1) assert.equal(canMove(0, z, false, 90), true);
  for (const [x, z] of [[-3.3, 2.5], [-2.03, 3.2], [3.55, -2.5], [4, 3.8], [3.5, -5.2], [2.75, 1.5], [-3.6, -4.55], [4.28, .48]])
    assert.equal(canMove(x, z, false), false);
  const r = createRun('containment-exit');
  for (let i = 0; i < 70; i++) move(r, 0, .1);
  assert.ok(r.z > 6.9);
  assert.equal(r.health, 100);
});

test('chamber delivery includes compressed geometry, physical glass, contact UVs and named mechanisms', () => {
  const binary = readFileSync(new URL('../public/models/containment.glb', import.meta.url));
  assert.ok(binary.byteLength < 8 * 1024 * 1024);
  assert.equal(binary.readUInt32LE(0), 0x46546c67);
  const gltf = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString());
  for (const extension of ['KHR_draco_mesh_compression', 'KHR_materials_transmission'])
    assert.ok(gltf.extensionsUsed.includes(extension));
  for (const name of ['CH_Door_Left', 'CH_Door_Right', 'CH_Pod_Canopy', 'CH_Bay_Canopy', 'CH_Vent_Fan'])
    assert.ok(gltf.nodes.some((n: { name: string }) => n.name === name), name);
  assert.ok(gltf.materials.some((m: { occlusionTexture?: { texCoord: number } }) => m.occlusionTexture?.texCoord === 1));
  assert.ok(readFileSync(new URL('../public/draco/draco_decoder.wasm', import.meta.url)).length > 100000);
});
