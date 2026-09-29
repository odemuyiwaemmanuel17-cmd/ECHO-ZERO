# ECHO//ZERO — facility presentation build

A browser survival game built with React, TypeScript, React Three Fiber, Three.js and Zustand. The original playable loop is retained, with an authored industrial environment, local GLB models, animated machinery, first-person tools, and synthesized environmental sound.

## Run

Node.js 22.12+ required.

```sh
npm install
npm run dev
```

Open the URL printed by Vite. `npm test` checks gameplay rules. `npm run build` type-checks and produces `dist/`; `npm run preview` serves that build. Vercel can deploy using the Vite preset, build command `npm run build`, output `dist`. No environment variables or API keys are needed.

## Play the loop

1. Enter Facility. Click the world for mouse look, or use left/right arrows.
2. Move forward with W through Medical Bay into Storage. Approach the amber fuse on the left and press E.
3. Avoid or disable security machines. Restore power at the amber generator console in room 5 using E.
4. The security gate opens. Read the pale blue record on the left in the Archive; collect violet artifacts along the way.
5. Disconnect at the core after recovering the record, or continue to the green extraction pad. Extraction is always available after power restoration. Merge requires the archive record and two artifacts.
6. Review your score, download a run card, retry the same seed, or start another run. Death also produces a scored summary and restart options.

WASD move; mouse or arrows turn; Shift sprints; E interacts; F toggles light; 1–3 equip cutter/baton/EMP; click or Space attacks; Escape/Tab pauses. Click again after resuming to recapture the mouse. Touch devices get movement, turning, and firing buttons plus the same interaction UI.

The cutter has limited ammo. Baton costs stamina. EMP disables nearby machines for seven seconds. Medkits and cells apply immediately; fuse, evidence and artifacts occupy dedicated quest slots. Inventory capacity and consumable storage are deliberately deferred.

## Scope and boundaries

- Eight connected objective rooms plus Maintenance and Command annexes. Room order, original objective positions and scoring are preserved; seeds vary artifact sides and enemy placement. The two annexes add visual storytelling without changing the eight-room exploration score.
- Three enemy archetypes with patrol/chase/attack/return behavior, three tools, health, energy and stamina.
- Deterministic scripted ECHO messages, opening trust choice, evidence, and three endings. No generative AI or external asset requests.
- Seeded UTC Daily Anomaly **practice**; browser-local run history and settings, PNG run card export.
- Simulation logic is separate from rendering in `src/game.ts`. Lightweight circle/room collision is used instead of a physics engine for this flat facility.
- No Supabase, authentication, global leaderboard, official daily submission, multiplayer, oxygen system, saved in-progress runs, procedural room ordering, or production anti-cheat yet. Local scores are not verified or competitive rankings.
- Desktop is primary; touch controls are basic. Browser storage can be cleared, and a refresh abandons the active run.

## Presentation and assets

- Ten dressed spaces: opening containment chamber, Medical Bay, Storage, Security Corridor, Generator, Research/Archive, Server Core, Extraction, Maintenance Tunnel and Command Center.
- Opening pod release, boot lighting, glass panels, vents, cables, floor grating, wall panels, environmental signage, abandoned equipment, and a destroyed drone.
- Modeled pickups with proximity rings, collection animation, audio and a small acquisition notice. Three visible tools have equip/use animation; mechanical enemy silhouettes replace the original blocks.
- Sliding industrial doors have access indicators and motor sounds. Restoring power starts the turbine rotors and brings lights online. The first Sentinel arrives after power restoration: sequential lights, a red-light warning, heavy footsteps, a twelve-second searchlight crossing, and ECHO’s “Now.” Movement and combat remain live; stay back or outside its cone.
- Directional flashlight with a single 512px shadow map, local lighting, fog, dust, steam and brief sparks. LOW disables flashlight shadows and reduces particles. Only nearby room dressing is mounted in the scene.
- Master volume and Reduced Motion persist locally. Reduced Motion defaults to the operating system preference, suppresses camera bob/recoil, sparks, light modulation and Shade distortion. No music loop, speech service, generated dialogue or remote audio assets.

`public/models/facility.glb` contains 18 original models authored by `scripts/build-assets.mjs` (about 1.4 MB total). Static meshes are merged by material while preserving articulated joints; clones share cached geometry/materials. Regenerate with `npm run assets`. Surface textures and signboards are small, locally generated Canvas textures; sound is synthesized with Web Audio after the player clicks Enter Facility. There are no third-party art packs or asset-service dependencies.

For development visual QA, open `http://127.0.0.1:5173/?review=1`, select a scene, and enter the facility. Generator review supplies a fuse so its existing interaction can be tested. Review runs are never saved to history. This selector is unavailable in production builds; remove `?review=1` to play normally.

## Validation

`npm test` covers deterministic generation, collision and locked gates, annex boundaries, consumables, combat/EMP, post-power encounter timing, scanning cones and drone noise investigation, death/reset, ending requirements, scoring, and required GLB assets/size. The full-run simulation walks through the facility with enemies active and completes each ending across three seeds, without teleporting or disabling combat. The menu, rendered containment scene, keyboard movement, generator interaction, door opening and power objective update were checked in the Codex browser. Device-specific pointer lock, touch support, audio mixing and hardware frame-rate targets still need broader manual testing.

## Atmosphere pass

Curated incidents include broken containment restraints, an overturned medical trolley, a maintenance panel with abandoned tools, a security barricade and camera wall, a specimen tank and robotic equipment, a collapsed machine near a core terminal, and an extraction blast door. Room lighting and hums vary. Seeded atmospheric events occur in short windows with quiet periods; they do not alter objectives. ECHO briefly appears on nearby monitor panels.

The Pulse Cutter has industrial cutting jaws, an exposed cell, a charge readout, and cell-replacement animation when collecting ammunition. Pickups travel toward the hand; terminal readouts disappear when leaving interaction range. Doors have four finishes, motor delay and containment pressure release. Audio uses distance attenuation and camera-relative stereo panning, not acoustic occlusion. Enemy searchlights use the same angular ranges as detection; walls block detection. Props remain decorative on the existing flat collision map; no new stair traversal or room topology system was introduced.
