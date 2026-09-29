# Containment Chamber benchmark

Scope: the opening chamber only. The original `public/models/facility.glb`, other room dressing, progression, controls, and combat are retained. The new physical furniture footprints block walking through the chamber's equipment while preserving the spawn-to-exit aisle.

## Source and rebuild

Editable Blender 4.5 scenes: `containment.blend` and `scanned-equipment.blend`. Production assets: `public/models/containment.glb` and `public/models/containment-props.glb`, with local Draco decoding and embedded PBR images. The scene is modelled in metres, with a 3.15 m suspended ceiling and 2.34 m door leaves. CC0 Poly Haven equipment supplements the custom geometry: a wheelchair, medical tray and industrial microscope.

Run these scripts in order using Blender's background mode:

1. `blender --background --factory-startup --python scripts/build-containment.py`
2. `blender --background --python scripts/bake-containment.py`
3. `blender --background --python scripts/finish-containment.py`
4. `blender --background --python scripts/detail-containment.py`
5. `blender --background --factory-startup --python scripts/import-containment-props.py`

The bake uses a finite 0.45 m occlusion radius and a separate 2048-pixel UV atlas. Moving mechanisms receive separate materials without the static occlusion atlas. Scanned base/normal/roughness maps use UV0. Source credits are in `public/textures/containment/CREDITS.md` (Powered by Poly Haven / CC0). Draco licensing is in `public/draco/LICENSE`.

## Runtime

`src/containment.tsx` loads the chamber, drives the original release/proximity animations, maintains two fixture shadow maps during motion, and supplies local reflections. HIGH uses refractive glass with condensation normals and half-resolution transmission; LOW retains all geometry and baked shading, using transparent glass and no real-time shadow maps. A scoped ventilation loop follows the existing volume and pause controls. Reduced Motion stops the ventilation animation and slows telemetry updates.

The next room mounts before the exit opens. Only the current and neighbouring rooms remain mounted. The chamber's reflection environment is restored on exit. F8 developer diagnostics show frame rate, render calls, triangles, textures and geometry counts.

Vite ignores `.tools`, Blender source files and authoring logs to avoid Windows file-watch failures. The portable Blender runtime in `.tools` is not part of the shipped game.

## Validation status

Automated progression, combat and collision tests pass. First-person checks covered release, ECHO contact, walking to the exit and its proximity animation. Desktop and phone viewport inspection is ongoing; this is not yet a signed-off visual benchmark. No other room should inherit this art pass until that review is complete.

2026-09-29 verification: TypeScript and production Vite build passed; all 22 gameplay/asset tests passed, including wheelchair, prep-bench and damaged-hatch collision coverage. The production build still reports its large JavaScript chunk warning (1.26 MB before gzip). `live-review.png` records the actual browser render after adding pod service panels, hatch retention cables and cylinder floor supports. The live review reported roughly 200k triangles and 60 draw calls at that viewpoint, with uneven frame rates; this is not a performance sign-off. Complete foreground performance profiling and the remaining LOW/mobile visual matrix before extending the room's art treatment elsewhere.
