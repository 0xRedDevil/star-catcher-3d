# Rainbow Sky Track Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Star Catcher 3D's flat path with an endlessly generated rainbow track in space that climbs, dips and banks, ridden from just behind a rainbow board. This plan covers stage 1 (track and riding) in full; stages 2 and 3 are outlined at the end and get their own plans.

**Architecture:** Pure maths (track generation, riding, scoring) lives in Three.js-free ES modules under `js/` and is unit-tested with `node --test`. Three.js modules build meshes from that maths, and `js/main.js` wires the scene, input, HUD and loop. `index.html` keeps the markup, CSS and import map. There is no build step: GitHub Pages serves the files as they are.

**Tech Stack:** Three.js 0.160.0 (CDN import map in the browser, npm dev dependency for tests), Node 20 `node:test`, plain ES modules.

**Spec:** `docs/superpowers/specs/2026-11-03-star-catcher-3d-design.md`

## Global Constraints

- Three.js exactly `0.160.0`, loaded in the browser from `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`, with `three/addons/` at `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/`.
- No build step. `package.json` exists only for `"type": "module"`, the test script and the `three@0.160.0` dev dependency. Add `node_modules/` to `.gitignore`.
- Track width about 12 units; rider lateral limit ±5.3; wall height about 0.8.
- Track sections last 30 to 70 units. Slope stays within −0.25 to +0.2. Tightest turn radius is 25 units (`|yawRate| ≤ 0.04` rad per unit). Bank is capped at 25° (0.436 rad).
- Generate about 150 units ahead and keep about 20 behind.
- Slope changes speed by at most ±20% of the base speed.
- Camera roll is half the track bank. Field of view is 70° in landscape and wider (80°) in portrait.
- Scoring for stage 1 stays as it is in the current draft: 1 point per 4 units, star 10 × combo, combo +1 per 3 catches, up to x5.
- `localStorage` access is wrapped in try/catch.
- Commits are authored as 0xRedDevil (already set in the repo config). Commit after each task. Push to `main` only after the owner has play-tested on their computer and said go.
- The look stays the game's own: no names, art or layouts from Mario Kart or Snow Rider.

## Review Focus

1. **The tab is hidden and then shown again.** The first frame back has a huge `dt`. Expect no teleporting through obstacles and no speed spike. The step is clamped to 0.05 s. Pinned in Task 2: `advanceRide clamps a huge dt`.
2. **A very long run (over 20,000 units).** Expect memory to stay flat and no visible jitter. Pinned in Task 1: `pruneBefore keeps frame count bounded over 20000 units`.
3. **Holding steer into a wall on a sharp bend.** Expect the board to sit still at the limit and not jitter back and forth. Pinned in Task 2: `holding into the wall stays at the limit without oscillating`.
4. **Rotating a phone mid-ride.** Expect the field of view, aspect and wand position to update on the next frame. Checked by hand in Task 4, step 4.
5. **A drag that starts on the HUD, or a second finger touching.** Expect steering to follow only the first finger, and the HUD not to block it. Checked by hand in Task 4, step 4 (the HUD has `pointer-events: none`, and steering tracks one `pointerId`).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `.gitignore` | ES-module mode, `npm test`, `three` dev dependency |
| `js/rng.js` | seeded random numbers, so tracks and tests are repeatable |
| `js/track.js` | track generator: frames per unit, sections, smoothing, bank, crest detection, pruning (no Three.js) |
| `js/riding.js` | speed from slope, steering and wall clamp, crest float, clamped step (no Three.js) |
| `js/scoring.js` | distance points, catches, combo multiplier (no Three.js), moved from the draft |
| `js/models.js` | low-poly baking helpers, star/heart/bolt shapes, rainbow board, wand, moved from the draft |
| `js/trackMesh.js` | builds track and wall chunk meshes from frames, and keeps chunks ahead/behind |
| `js/sky.js` | starfield, moon, sky clouds, glitter, moved from the draft |
| `js/main.js` | renderer, camera, input, HUD, screens, audio, leaderboard, game loop |
| `index.html` | markup, CSS, import map, `<script type="module" src="js/main.js">` |
| `tests/*.test.js` | `node:test` tests for each module above that has logic |

---

### Task 1: Track generator

**Files:**
- Create: `package.json`, `.gitignore`, `js/rng.js`, `js/track.js`
- Test: `tests/track.test.js`

**Interfaces:**
- Produces:
  - `createRng(seed: number) => () => number` in `js/rng.js` (mulberry32, values in [0, 1)).
  - `createTrack({ seed: number, difficulty?: () => number, sections?: Array<{ length: number, yawRate: number, slope: number }> })` in `js/track.js`. `difficulty` returns 0..1 (default `() => 0`). `sections`, when given, replaces random section picks (used by tests).
  - It returns `{ ensure(sMax: number): void, frameAt(s: number): Frame, crestLift(s: number): number, pruneBefore(s: number): void, frameCount(): number }`.
  - `Frame = { s, x, y, z, fx, fy, fz, rx, ry, rz, ux, uy, uz, yawRate, slope, bank }`. `f*` is the unit forward direction, `r*` the unit right direction with bank applied, `u*` the unit up direction. Frames are stored one per unit, and `frameAt` linearly interpolates fractional `s`.
  - Exported constants: `TRACK_HALF_WIDTH = 6`, `MAX_YAW_RATE = 0.04`, `MIN_SLOPE = -0.25`, `MAX_SLOPE = 0.2`, `MAX_BANK = 0.436`.

- [ ] **Step 1: Set up the test harness**

`package.json` contains `{ "type": "module", "private": true, "scripts": { "test": "node --test tests/" }, "devDependencies": { "three": "0.160.0" } }`. `.gitignore` contains `node_modules/`. Run `npm install`.

- [ ] **Step 2: Write the failing tests in `tests/track.test.js`**

```js
test('frames are 1 unit apart', ...)                       // |pos(s+1) - pos(s)| within 1e-6 of 1, for s in 0..2000
test('frame axes are unit length and perpendicular', ...)  // |f|, |r|, |u| ≈ 1; f·r, f·u, r·u ≈ 0 (1e-6)
test('turn rate never tighter than radius 25', ...)        // |yawRate| <= MAX_YAW_RATE over 20000 units, difficulty () => 1
test('slope stays within limits', ...)                     // MIN_SLOPE <= slope <= MAX_SLOPE over 20000 units
test('bank is capped and leans into the turn', ...)        // |bank| <= MAX_BANK; sign(bank) === sign(yawRate) when |yawRate| > 0.005
test('turn rate and slope change smoothly', ...)           // per unit: |Δ yawRate| <= 0.004, |Δ slope| <= 0.02
test('height stays within a band', ...)                    // |y| <= 40 over 20000 units, three different seeds
test('same seed gives the same track', ...)                // frameAt(1234) equal for two tracks with seed 7
test('difficulty widens the allowed turns', ...)           // max |yawRate| over 5000 units: difficulty 1 > difficulty 0
test('crestLift is high where a climb turns into a drop', ...)
// sections: [{length:60,yawRate:0,slope:0.15},{length:60,yawRate:0,slope:-0.2}]: crestLift near s=60 > 0.5; crestLift(20) === 0
test('pruneBefore keeps frame count bounded over 20000 units', ...)
// loop s from 0 to 20000 step 10: ensure(s+150); pruneBefore(s-20); assert frameCount() <= 200 throughout
```

- [ ] **Step 3: Run the tests to check they fail**

Run: `npm test`
Expected: FAIL, because `js/track.js` does not exist.

- [ ] **Step 4: Implement `js/rng.js` and `js/track.js`**

The approach for each new unit:
- When the current section has ended, pick a new section: length 30 to 70; a target turn rate chosen from {0, ±0.4, ±0.7, ±1.0} × `MAX_YAW_RATE × (0.5 + 0.5 × difficulty())`; and a target slope chosen uniformly from the slope range. Then add a pull toward home height: `targetSlope -= clamp(y / 200, -0.1, 0.1)`, clamped back into range.
- Ease the turn rate and slope toward their targets with per-unit step caps of 0.004 and 0.02.
- `bank = clamp(yawRate / MAX_YAW_RATE × MAX_BANK, ±MAX_BANK)`.
- Advance the position by the forward direction from (yaw, `atan(slope)`). Build right = normalize(forward × worldUp), rotated by the bank about forward, then up = right × forward.
- `crestLift(s) = clamp(-(slope(s+3) - slope(s-3)) / 0.15, 0, 1)`.

- [ ] **Step 5: Run the tests to check they pass**

Run: `npm test`
Expected: all `track.test.js` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore js/rng.js js/track.js tests/track.test.js
git commit -m "Add track generator with tests"
```

### Task 2: Riding model and scoring module

**Files:**
- Create: `js/riding.js`, `js/scoring.js`
- Test: `tests/riding.test.js`, `tests/scoring.test.js`

**Interfaces:**
- Consumes: `TRACK_HALF_WIDTH` from `js/track.js`.
- Produces:
  - `RIDER_LIMIT = 5.3`, `MAX_DT = 0.05` in `js/riding.js`.
  - `slopeSpeed(base: number, slope: number) => number`: downhill (negative slope) is faster, clamped to `base × [0.8, 1.2]`.
  - `steer(x: number, targetX: number, dt: number) => { x: number, wallTouch: boolean }`: eases `x` toward `targetX` clamped to ±`RIDER_LIMIT`. `wallTouch` is true when `targetX` lies beyond the limit and `x` is at it.
  - `advanceRide(state: { s: number, speed: number }, base: number, slope: number, dt: number) => { s: number, speed: number }`: clamps `dt` to `MAX_DT` and eases speed toward `slopeSpeed`.
  - `createScoring()` in `js/scoring.js` returns `{ score, combo, bestMultiplier, addDistance(units), addCatch(points) => { multiplierUp: boolean }, bump(), multiplier() }`, with the stage-1 values from Global Constraints.

- [ ] **Step 1: Write the failing tests**

```js
// tests/riding.test.js
test('downhill is faster and uphill slower, within 20%', ...) // slopeSpeed(10,-0.25) === 12; slopeSpeed(10,0.2) >= 8 and < 10; slopeSpeed(10,0) === 10
test('steering clamps at the wall and reports the touch', ...) // repeated steer toward 9 ends with x === 5.3 and wallTouch true
test('holding into the wall stays at the limit without oscillating', ...) // 200 steps toward 9: every x after reaching 5.3 is exactly 5.3
test('advanceRide clamps a huge dt', ...) // advanceRide({s:0,speed:20},20,0,5).s <= 20 * 0.05 + 1e-9

// tests/scoring.test.js
test('1 point per 4 units of distance', ...)   // addDistance(10) then addDistance(6): score === 4
test('combo rises every 3 catches, max x5', ...) // 3 catches -> multiplier 2; 30 catches -> 5
test('a bump resets the combo', ...)          // after bump(), multiplier() === 1, score unchanged
test('a star scores 10 times the combo', ...) // 1st and 2nd stars add 10 each; the 3rd lifts the combo to x2 and adds 20 (score 40)
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npm test`
Expected: FAIL, because the `riding` and `scoring` modules are missing.

- [ ] **Step 3: Implement `js/riding.js` and `js/scoring.js`**

Steering eases by `min(1, dt × 8)`, as the draft does. `slopeSpeed = clamp(base × (1 - slope × 0.8), 0.8 × base, 1.2 × base)`. `scoring.js` is the draft's `multiplier`/`addCatch` logic moved here, with the HUD calls taken out.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/riding.js js/scoring.js tests/riding.test.js tests/scoring.test.js
git commit -m "Add riding model and scoring module with tests"
```

### Task 3: Track and wall meshes

**Files:**
- Create: `js/trackMesh.js`
- Test: `tests/trackMesh.test.js`

**Interfaces:**
- Consumes: `createTrack`, `TRACK_HALF_WIDTH` from Task 1.
- Produces:
  - `buildChunk(track, s0: number, s1: number, style: { colors: string[], wallColor: number }) => THREE.Group` containing a `ribbon` mesh (named `'ribbon'`) and two wall meshes (named `'wall-left'` and `'wall-right'`).
  - `createTrackView(track, scene: THREE.Object3D, style)` returns `{ update(sRider: number): void, dispose(): void }`. It keeps chunks of `CHUNK_LENGTH = 50` from `sRider - 20` to `sRider + 150`, and disposes geometry and materials of chunks that fall behind.

- [ ] **Step 1: Write the failing tests**

```js
test('ribbon has two vertices per unit', ...)        // buildChunk(track,0,50,style): ribbon position count === 51 * 2
test('ribbon edges sit 6 units from the centre', ...) // distance from ribbon vertex pairs to frameAt(s) === TRACK_HALF_WIDTH (1e-6)
test('walls stand 0.8 above the track edge', ...)     // wall top vertices = edge + up * 0.8 (1e-6)
test('view keeps only nearby chunks', ...)           // fake scene; update(0..3000 step 5): children count <= ceil(170/50)+1
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npm test`
Expected: FAIL, because `js/trackMesh.js` is missing.

- [ ] **Step 3: Implement `js/trackMesh.js`**

The ribbon is a `BufferGeometry` strip with UV `u` across the track (0 to 1) and `v = s / 8` along it. Its material is a `MeshBasicMaterial` with a `CanvasTexture` of rainbow stripes running along the track, and `side: DoubleSide`. Each wall is a vertical strip using a `MeshBasicMaterial` that is transparent (opacity about 0.25), additive, `depthWrite: false` and double-sided, plus a brighter thin top edge line, so space stays visible through it. Guard the canvas texture behind `typeof document !== 'undefined'` so tests run in Node.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add js/trackMesh.js tests/trackMesh.test.js
git commit -m "Build track and see-through wall meshes from frames"
```

### Task 4: Ride it: wire the game onto the track

**Files:**
- Create: `js/models.js`, `js/sky.js`, `js/main.js`
- Modify: `index.html` (keep the markup and CSS from the draft; replace the inline module script with the import map plus `<script type="module" src="js/main.js"></script>`)
- Modify: `README.md` (how to run the tests and serve locally)

**Interfaces:**
- Consumes: everything from Tasks 1 to 3.
- Produces:
  - `models.js` exports `starGeo`, `starMat`, `heartGeo`, `heartMat`, `boltGeo`, `boltMat`, `makeGlow(color, size, opacity)`, `glowTex`, `createBoard() => THREE.Group`, `createWand() => { group, glow }`, plus the baking helpers `part`, `bake`, `rough`, `lump` and the obstacle makers from the draft, unchanged, for stage 2.
  - `sky.js` exports `createSky(scene) => { update(dt, riderPos: THREE.Vector3) }`. Starfield, moon and clouds follow the rider's position, so space always surrounds the track.

- [ ] **Step 1: Move the reusable draft code into `models.js` and `sky.js`**

Move the code as it is from the current `index.html` draft. Drop the flat `world` tilt, the ground, the lanterns and the cliffs.

- [ ] **Step 2: Write `js/main.js`**

- **Rider pose:** `frameAt(s)` gives the position, offset by `x × right`, lifted by `0.18 + crestLift(s) × 0.35`. The board is oriented from the frame's basis (forward, up, right), with extra roll `bank × 0.3` from steering velocity.
- **Camera:** placed at the rider pose `- forward × 2.2 + up × 1.5`. It looks at the frame 10 units ahead (`+ up × 0.6`), rolls by half the frame bank, and lifts with `crestLift`.
- **Stars:** for stage 1 testing only, a star sits at a random `x` in ±4 every 25 to 40 units. They're collected when within 0.8 laterally and within the swept `s` window. Also keep the start screen, HUD, combo, audio, leaderboard and hit flash from the draft.
- **End ride:** with no obstacles until stage 2, add an "End ride" button (top-right, small) and the Escape key, both showing the existing game-over screen.
- **Wall touch:** gives a sparkle burst at the wall and a soft "boing" sound (a short sine drop from 300 Hz to 180 Hz), at most once every 0.4 s.
- **Speed:** base speed `11 + elapsed × 0.15` capped at 22 (the Easy values), passed through `advanceRide` with the frame slope.
- **Moving space:** call `trackView.update(s)` and `sky.update(dt, riderPos)` each frame.

- [ ] **Step 3: Run the unit tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 4: Play-test in the browser**

Serve with `python -m http.server 5175` and open `http://127.0.0.1:5175/`. Check each of these:
- The track visibly climbs, dips and banks into left and right bends within the first 30 seconds.
- Stars and the moon are visible through the walls.
- The board fills roughly the lower third of the screen and leans into bends.
- Holding a key into a wall makes the board sit still at the wall, with a sparkle and a boing.
- There's a float at hilltops.
- The console shows no errors.
- About 60 fps on desktop: `renderer.info.render.calls` stays under 300 and the frame time under 16 ms.
- In the phone view (375×812): the track and board are visible, and the wand is on screen. Resize to landscape and back mid-ride: the view adapts.
- Dragging works from anywhere on the canvas, including under the HUD.

- [ ] **Step 5: Commit**

```bash
git add index.html README.md js/models.js js/sky.js js/main.js
git commit -m "Ride the generated rainbow track in space"
```

- [ ] **Step 6: Owner play-test and push**

The owner plays it on their computer. Push to `main` (which publishes the live site) only after they say go.

---

## Stage 2 outline: obstacles and placement (separate plan)

- `js/placement.js` (pure, tested):
  - Rows at a shrinking gap.
  - A safe lane that random-walks by ±1.2 per row.
  - Clearance of obstacle radius + 1.3 around the safe lane, and radius + 0.3 between obstacles.
  - No obstacles within 12 units after a crest (`crestLift > 0.3`), and fewer on sharp bends.
  - Breathers about every 40 s.
  - Stars on 1 row in 4 (sometimes a trail of 3); hearts only in Easy (3%).
  - Rolling planets confined to one side of the safe lane.
- **Obstacles:** reuse the draft's makers (rocks, toadstools, snowmen, crystal trees, fairy houses, storm clouds) and add a rolling planet. Place them by `(s, x)`.
- **Collision and near misses:** use `(s, x)` with a swept `s` window. A near miss is within 0.4 of the hit distance, and counts as a catch worth 5 × combo.
- **Lives:** lives, the blink, the hit flash and game over replace the "End ride" button.

## Stage 3 outline: modes, zones and unlocks (separate plan)

- `js/storage.js` (pure, tested):
  - Per-mode leaderboards and bests.
  - Unlocks and selected board.
  - Last mode played.
  - A one-time migration of `star_catcher_3d_leaderboard` into Easy that doesn't unlock boards.
- **Modes:** Easy and Hard parameters as in the spec's table.
- **Zones:** a zone sequence by distance (Candy Nebula, Crystal Galaxy, Rainbow Moon, …) that changes the track stripe colours, wall glow, sky tint and scenery, with a zone toast. The game-over screen shows the zone reached.
- **Boards:** Starter, Candy (2,000), Galaxy (5,000) and Super Rainbow (10,000, glitter trail). The start-screen picker shows a padlock on locked boards, and an unlock banner appears mid-run.
- **Feedback and flow:** a "NEW BEST!" pop-up, "Ride again" restarting the same mode and board in one tap, and a "Menu" button.
- **Tuning:** tune the scoring and speed numbers against the unlock targets by play-testing.
