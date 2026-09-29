// Original ECHO//ZERO models. No third-party art or runtime asset service.
import * as T from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { mkdir, writeFile } from "node:fs/promises";
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = v;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((v) => {
      this.result = `data:${blob.type};base64,${Buffer.from(v).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const scene = new T.Scene();
const mat = (color, metal = 0.6, rough = 0.42, glow = false) =>
  new T.MeshStandardMaterial({
    color,
    metalness: metal,
    roughness: rough,
    emissive: glow ? color : 0,
    emissiveIntensity: glow ? 1.5 : 0,
  });
const steel = mat("#52636b"),
  dark = mat("#161e24"),
  white = mat("#a7b3af", 0.3),
  orange = mat("#b47c39"),
  red = mat("#97483c"),
  cyan = mat("#7be6db", 0.2, 0.3, true),
  amber = mat("#ffbc64", 0.2, 0.3, true),
  rubber = mat("#0a1116", 0.1, 0.8),
  purple = mat("#9186db", 0.4, 0.3, true);
const glass = new T.MeshStandardMaterial({
  color: "#83b7b5",
  transparent: true,
  opacity: 0.18,
  metalness: 0.1,
  roughness: 0.19,
  depthWrite: false,
});
const cache = new Map();
function geom(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}
function box(g, p, s, m = steel) {
  const mesh = new T.Mesh(
    geom("box", () => new T.BoxGeometry(1, 1, 1)),
    m,
  );
  mesh.position.set(...p);
  mesh.scale.set(...s);
  g.add(mesh);
  return mesh;
}
function bevel(g, p, s, m = steel) {
  const mesh = new T.Mesh(
    geom("bevel", () => {
      const sh = new T.Shape();
      sh.moveTo(-0.45, -0.45);
      sh.lineTo(0.45, -0.45);
      sh.lineTo(0.45, 0.45);
      sh.lineTo(-0.45, 0.45);
      sh.closePath();
      const geo = new T.ExtrudeGeometry(sh, {
        depth: 0.9,
        bevelEnabled: true,
        bevelSegments: 1,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05,
      });
      geo.translate(0, 0, -0.45);
      return geo;
    }),
    m,
  );
  mesh.position.set(...p);
  mesh.scale.set(...s);
  g.add(mesh);
  return mesh;
}
function cyl(g, p, r, h, m = steel, rot = [0, 0, 0], r2 = r) {
  const key = `c${r}:${r2}:${h}`;
  const mesh = new T.Mesh(
    geom(key, () => new T.CylinderGeometry(r2, r, h, 16)),
    m,
  );
  mesh.position.set(...p);
  mesh.rotation.set(...rot);
  g.add(mesh);
  return mesh;
}
function ring(g, p, r, t, m = steel, rot = [0, 0, 0]) {
  const mesh = new T.Mesh(
    geom(`r${r}:${t}`, () => new T.TorusGeometry(r, t, 6, 24)),
    m,
  );
  mesh.position.set(...p);
  mesh.rotation.set(...rot);
  g.add(mesh);
  return mesh;
}
function group(name, parent = scene) {
  const g = new T.Group();
  g.name = name;
  parent.add(g);
  return g;
}
function bolts(g, width, height, z) {
  for (const x of [-width, width])
    for (const y of [-height, height])
      cyl(g, [x, y, z], 0.025, 0.035, white, [Math.PI / 2, 0, 0]);
}
{
  const g = group("cell");
  cyl(g, [0, 0.25, 0], 0.16, 0.46, dark);
  cyl(g, [0, 0.25, 0], 0.12, 0.4, cyan);
  for (const y of [0, 0.1, 0.4, 0.5]) cyl(g, [0, y, 0], 0.18, 0.055, steel);
  for (const x of [-0.13, 0.13])
    box(g, [x, 0.25, 0], [0.035, 0.5, 0.17], steel);
  cyl(g, [0, 0.55, 0], 0.07, 0.05, orange);
}
{
  const g = group("fuse");
  bevel(g, [0, 0.32, 0], [0.28, 0.58, 0.18], orange);
  box(g, [0, 0.32, 0.1], [0.13, 0.28, 0.025], dark);
  for (const y of [0.22, 0.3, 0.38])
    box(g, [0, y, 0.117], [0.08, 0.022, 0.01], amber);
  for (const x of [-0.075, 0.075]) cyl(g, [x, -0.06, 0], 0.025, 0.19, white);
  ring(g, [0, 0.68, 0], 0.11, 0.035, steel);
  bolts(g, 0.1, 0.25, 0.12);
}
{
  const g = group("medkit");
  bevel(g, [0, 0.19, 0], [0.5, 0.35, 0.22], white);
  box(g, [0, 0.19, 0.12], [0.09, 0.24, 0.02], red);
  box(g, [0, 0.19, 0.13], [0.27, 0.08, 0.02], red);
  box(g, [0, 0.39, 0], [0.24, 0.05, 0.1], dark);
  cyl(g, [0.3, 0.15, 0], 0.055, 0.27, white);
  cyl(g, [0.3, 0.3, 0], 0.06, 0.06, red);
}
{
  const g = group("artifact");
  ring(g, [0, 0.3, 0], 0.25, 0.045, steel, [0.5, 0.3, 0]);
  ring(g, [0, 0.3, 0], 0.16, 0.035, orange, [0, 1, 0]);
  const crystal = new T.Mesh(new T.IcosahedronGeometry(0.12, 0), purple);
  crystal.position.y = 0.3;
  g.add(crystal);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    const fin = bevel(
      g,
      [Math.sin(a) * 0.21, 0.3 + Math.cos(a) * 0.21, 0],
      [0.12, 0.2, 0.08],
      dark,
    );
    fin.rotation.z = -a;
  }
}
{
  const g = group("log");
  bevel(g, [0, 0.04, 0], [0.48, 0.06, 0.32], steel);
  box(g, [0, 0.078, 0], [0.4, 0.015, 0.25], cyan);
  for (let i = 0; i < 4; i++)
    box(
      g,
      [-0.02, 0.09, -0.08 + i * 0.045],
      [0.26 - i * 0.04, 0.005, 0.008],
      dark,
    );
}
{
  const g = group("crate");
  bevel(g, [0, 0.48, 0], [1.15, 0.96, 0.8], dark);
  for (const x of [-0.52, 0.52]) box(g, [x, 0.48, 0], [0.07, 0.9, 0.88], steel);
  for (const y of [0.08, 0.88]) box(g, [0, y, 0], [1.16, 0.08, 0.88], steel);
  bevel(g, [0, 0.45, 0.42], [0.75, 0.52, 0.07], orange);
  box(g, [0, 0.57, 0.47], [0.38, 0.07, 0.02], dark);
  bolts(g, 0.46, 0.35, 0.46);
}
{
  const g = group("terminal");
  bevel(g, [0, 0.08, 0], [1.05, 0.16, 0.7], dark);
  bevel(g, [0, 0.65, 0], [0.44, 1.2, 0.4], steel);
  const head = group("screenHousing", g);
  head.position.set(0, 1.3, -0.03);
  head.rotation.x = -0.2;
  bevel(head, [0, 0, 0], [1.05, 0.72, 0.17], dark);
  box(head, [0, 0, 0.1], [0.87, 0.53, 0.02], mat("#173a40", 0.1, 0.65, true));
  bevel(g, [0, 1, 0.25], [1.05, 0.12, 0.52], steel);
  for (let i = 0; i < 6; i++)
    box(g, [-0.3 + i * 0.12, 1.07, 0.3], [0.07, 0.02, 0.14], dark);
}
{
  const g = group("rack");
  bevel(g, [0, 1.45, 0], [1.15, 2.9, 0.82], dark);
  for (let i = 0; i < 9; i++) {
    bevel(g, [0, 0.23 + i * 0.3, 0.42], [0.97, 0.23, 0.08], steel);
    for (let j = 0; j < 5; j++)
      box(
        g,
        [-0.27 + j * 0.13, 0.23 + i * 0.3, 0.47],
        [0.07, 0.08, 0.01],
        rubber,
      );
    box(
      g,
      [0.38, 0.23 + i * 0.3, 0.48],
      [0.03, 0.045, 0.01],
      i % 3 ? cyan : amber,
    );
  }
  box(g, [0, 2.94, 0], [1.22, 0.07, 0.87], steel);
}
{
  const g = group("bed");
  for (const x of [-0.5, 0.5])
    for (const z of [-0.85, 0.85]) {
      cyl(g, [x, 0.36, z], 0.04, 0.6, steel);
      cyl(g, [x, 0.08, z], 0.09, 0.06, dark, [Math.PI / 2, 0, 0]);
    }
  bevel(g, [0, 0.68, 0], [1.25, 0.2, 2.2], steel);
  bevel(g, [0, 0.84, 0], [1.1, 0.16, 1.95], white);
  bevel(g, [0, 0.96, -0.65], [0.8, 0.13, 0.42], white);
  for (const z of [-0.25, 0.3]) box(g, [0, 0.96, z], [1.13, 0.04, 0.09], dark);
  for (const x of [-0.65, 0.65]) box(g, [x, 1, 0], [0.035, 0.04, 1.5], steel);
}
{
  const g = group("pod");
  bevel(g, [0, 0.18, 0], [2.3, 0.36, 1.55], steel);
  bevel(g, [0, 1.65, -0.5], [2.1, 3.15, 0.4], dark);
  bevel(g, [0, 1.65, -0.23], [1.32, 2.75, 0.24], white);
  for (const x of [-0.94, 0.94]) {
    cyl(g, [x, 1.75, 0.1], 0.11, 2.9, steel);
    box(g, [x, 1.75, 0.23], [0.035, 2.2, 0.06], cyan);
  }
  bevel(g, [0, 3.2, 0], [2.2, 0.36, 1.2], steel);
  bevel(g, [0, 0.5, 0.1], [1.35, 0.3, 0.8], dark);
  const lid = group("podLid", g);
  lid.position.y = 0.3;
  bevel(lid, [0, 1.42, 0.57], [1.8, 2.8, 0.075], glass);
  for (const x of [-0.87, 0.87])
    box(lid, [x, 1.42, 0.6], [0.045, 2.8, 0.055], steel);
  for (const y of [0, 2.8]) box(lid, [0, y, 0.6], [1.8, 0.045, 0.05], steel);
  for (let i = 0; i < 12; i++)
    box(
      lid,
      [-0.7 + (i % 4) * 0.4, 0.3 + Math.floor(i / 4) * 0.65, 0.62],
      [0.015, 0.3 + i * 0.008, 0.002],
      glass,
    );
}
{
  const g = group("turbine");
  cyl(g, [0, 0.3, 0], 0.95, 0.6, dark);
  cyl(g, [0, 1.45, 0], 0.7, 2.3, steel);
  for (const y of [0.5, 1, 2, 2.5]) cyl(g, [0, y, 0], 0.85, 0.12, dark);
  cyl(g, [0, 1.5, 0], 0.73, 0.38, cyan);
  const rotor = group("rotor", g);
  rotor.position.y = 2.75;
  ring(rotor, [0, 0, 0], 0.76, 0.07, orange, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) {
    const blade = bevel(
      rotor,
      [Math.sin(i * 0.785) * 0.45, 0, Math.cos(i * 0.785) * 0.45],
      [0.18, 0.12, 0.66],
      steel,
    );
    blade.rotation.y = i * 0.785;
  }
}
{
  const g = group("drone");
  const shell = new T.Mesh(new T.SphereGeometry(0.4, 16, 10), dark);
  shell.scale.set(1, 0.6, 1.3);
  g.add(shell);
  ring(g, [0, 0, 0], 0.48, 0.055, steel, [Math.PI / 2, 0, 0]);
  for (const x of [-0.62, 0.62]) {
    bevel(g, [x, 0, 0], [0.3, 0.18, 0.65], steel);
    cyl(g, [x, 0.06, 0], 0.2, 0.05, dark);
    ring(g, [x, 0.11, 0], 0.16, 0.025, cyan, [Math.PI / 2, 0, 0]);
  }
  cyl(g, [0, -0.02, 0.47], 0.11, 0.1, amber, [Math.PI / 2, 0, 0]);
  cyl(g, [0, -0.22, 0.3], 0.07, 0.5, steel, [Math.PI / 2, 0, 0]);
}
{
  const g = group("sentinel");
  for (const x of [-0.46, 0.46]) {
    cyl(g, [x, 1.5, -0.3], 0.16, 0.7, dark);
    for (const y of [1.3, 1.6, 1.8])
      ring(g, [x, y, -0.3], 0.18, 0.025, steel, [Math.PI / 2, 0, 0]);
    bevel(g, [x, 1.85, 0.15], [0.35, 0.3, 0.6], orange);
    box(g, [x, 1.9, 0.46], [0.2, 0.05, 0.03], amber);
  }
  cyl(g, [0, 2.15, 0.35], 0.18, 0.24, dark, [Math.PI / 2, 0, 0]);
  cyl(g, [0, 2.15, 0.49], 0.14, 0.025, amber, [Math.PI / 2, 0, 0]);
  bevel(g, [0, 1.55, 0], [1.12, 1.12, 0.7], dark);
  bevel(g, [0, 1.7, 0.37], [0.93, 0.57, 0.13], steel);
  bevel(g, [0, 2.21, 0.02], [0.54, 0.37, 0.48], steel);
  box(g, [0, 2.22, 0.27], [0.37, 0.07, 0.045], amber);
  for (const x of [-0.7, 0.7]) {
    cyl(g, [x, 1.95, 0], 0.22, 0.3, orange, [0, 0, Math.PI / 2]);
    const arm = group(x < 0 ? "leftArm" : "rightArm", g);
    arm.position.set(x, 1.8, 0);
    bevel(arm, [0, -0.37, 0], [0.27, 0.7, 0.29], steel);
    cyl(arm, [0, -0.77, 0.12], 0.12, 0.48, dark, [Math.PI / 2, 0, 0]);
  }
  for (const x of [-0.34, 0.34]) {
    const leg = group(x < 0 ? "leftLeg" : "rightLeg", g);
    leg.position.set(x, 1.04, 0);
    cyl(leg, [0, -0.22, 0], 0.1, 0.48, steel);
    bevel(leg, [0, -0.63, 0.03], [0.32, 0.49, 0.36], dark);
    cyl(leg, [0, -0.45, 0.08], 0.15, 0.36, orange, [0, 0, Math.PI / 2]);
    bevel(leg, [0, -0.94, 0.18], [0.4, 0.17, 0.65], steel);
  }
}
{
  const g = group("shade");
  cyl(g, [0, 1.4, 0], 0.18, 0.82, dark, undefined, 0.3);
  const head = new T.Mesh(new T.IcosahedronGeometry(0.22, 1), steel);
  head.position.y = 2.05;
  g.add(head);
  box(g, [0, 2.06, 0.2], [0.04, 0.19, 0.015], purple);
  for (const x of [-0.3, 0.3]) {
    cyl(g, [x, 1.2, 0], 0.045, 0.9, steel, [0, 0, x]);
    cyl(g, [x * 0.55, 0.48, 0], 0.065, 0.92, dark);
    ring(g, [0, 1.5, 0], 0.4, 0.013, purple, [Math.PI / 2, 0.2, 0]);
  }
}
{
  const g = group("cutter");
  bevel(g, [0, 0, 0], [0.28, 0.22, 0.42], orange);
  bevel(g, [0, -0.13, 0.08], [0.17, 0.16, 0.27], rubber);
  for (const x of [-0.16, 0.16]) {
    bevel(g, [x, 0, -0.25], [0.065, 0.18, 0.24], steel);
    box(g, [x, 0, -0.39], [0.035, 0.11, 0.08], cyan);
    for (let n = 0; n < 3; n++)
      box(g, [x, 0.125, -0.1 + n * 0.075], [0.035, 0.012, 0.02], dark);
  }
  const cell = group("powerCell", g);
  cyl(cell, [0.2, 0.03, 0.1], 0.07, 0.28, dark, [Math.PI / 2, 0, 0]);
  cyl(cell, [0.2, 0.03, 0.1], 0.045, 0.22, cyan, [Math.PI / 2, 0, 0]);
  for (const z of [-0.05, 0.25]) ring(cell, [0.2, 0.03, z], 0.08, 0.018, steel);
  bevel(g, [0, 0.13, 0.07], [0.2, 0.055, 0.15], dark);
  box(g, [0, 0.16, 0.07], [0.14, 0.012, 0.09], cyan);
  for (let n = 0; n < 7; n++)
    box(
      g,
      [-0.1 + n * 0.03, 0.115, -0.13],
      [0.012, 0.008, 0.025 + (n % 3) * 0.01],
      steel,
    );
}
{
  const g = group("baton");
  cyl(g, [0, 0.12, 0], 0.055, 0.75, steel);
  cyl(g, [0, -0.28, 0], 0.08, 0.3, rubber);
  for (const y of [0.12, 0.22, 0.32])
    ring(g, [0, y, 0], 0.07, 0.022, cyan, [Math.PI / 2, 0, 0]);
  cyl(g, [0, 0.52, 0], 0.09, 0.12, dark);
}
{
  const g = group("emp");
  bevel(g, [0, 0, 0], [0.24, 0.3, 0.17], steel);
  ring(g, [0, 0.04, 0.1], 0.075, 0.015, cyan);
  box(g, [0, -0.09, 0.09], [0.1, 0.025, 0.025], orange);
  cyl(g, [0.08, 0.22, 0], 0.012, 0.2, steel);
}
{
  const g = group("hand");
  bevel(g, [0, 0, 0], [0.15, 0.18, 0.22], dark);
  for (let i = 0; i < 4; i++)
    bevel(g, [-0.06 + i * 0.04, 0.065, -0.08], [0.035, 0.09, 0.12], steel);
  cyl(g, [0, -0.06, 0.26], 0.095, 0.4, dark, [Math.PI / 2, 0, 0]);
  ring(g, [0, -0.06, 0.12], 0.102, 0.023, orange);
}
// Batch static parts by material, while retaining named pod lids and robot joints.
function batch(group) {
  for (const child of [...group.children]) if (child.isGroup) batch(child);
  const byMaterial = new Map();
  for (const child of [...group.children])
    if (child.isMesh) {
      child.updateMatrix();
      const geometry = child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      if (!byMaterial.has(child.material)) byMaterial.set(child.material, []);
      byMaterial.get(child.material).push(geometry);
      group.remove(child);
    }
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries);
    const mesh = new T.Mesh(merged, material);
    group.add(mesh);
    geometries.forEach((g) => g.dispose());
  }
}
for (const object of scene.children) batch(object);
for (const object of scene.children)
  object.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
const binary = await new GLTFExporter().parseAsync(scene, { binary: true });
await mkdir("public/models", { recursive: true });
await writeFile("public/models/facility.glb", Buffer.from(binary));
console.log(
  `Authored ${scene.children.length} reusable models; ${(binary.byteLength / 1024).toFixed(0)} KiB`,
);
