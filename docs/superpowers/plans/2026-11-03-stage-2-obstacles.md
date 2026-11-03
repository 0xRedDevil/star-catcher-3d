# Stage 2: Obstacles, Space Look and Lives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put obstacles on the track that cost lives and end the ride, using the spec's fair placement rules. Switch the track to a see-through purple road and the sky to planets, nebulae and comets.

**Architecture:** As in stage 1, the logic lives in Three.js-free modules tested with `node --test`: `placement.js` (what goes where), `collision.js` (hits, near misses, rolling planets) and `lives.js` (lives and the safety blink). `track.js` gains a no-curl-back rule. `main.js` turns placements into models, runs collisions and drives the HUD. Mode settings (Easy/Hard) come in stage 3. This stage uses the Easy values throughout.

**Tech Stack:** Three.js 0.160.0 (CDN in the browser, dev dependency for tests), Node 20 `node:test`, plain ES modules, no build step.

**Spec:** `docs/superpowers/specs/2026-11-03-star-catcher-3d-design.md`

## Global Constraints

- Everything in stage 1's Global Constraints still applies (`docs/superpowers/plans/2026-11-03-rainbow-sky-track.md`).
- **No pop-in:** over any 150 units of track, the straight-line distance from start to end is at least 120.
- **Safe lane:** steps at most ±1.2 per row. Clearance is obstacle radius + 1.3. Obstacles in a row keep apart by the sum of their radii + 0.3.
- **No obstacles** within 12 units after a crest (where `crestLift > 0.3`), and none before s = 40.
- **Collectibles:** stars on about 1 row in 4, sometimes as a trail of 3, always in the safe lane. Hearts on about 3% of rows, only when the mode allows.
- **Rolling planets:** start after 30 s (Easy), appear on about 20% of rows, and stay on one side of the safe lane.
- **Collision:** rider half-width 0.35. A swept `s` window of `(prevS - 0.6, s + 0.4]`. A near miss is a lateral gap under 0.4, and it counts as a catch worth 5 × combo.
- **Lives:** start at 3, hearts heal up to 5, a hit gives 1.5 s of safety, and game over at 0.
- **Easy pacing for stage 2:** row gap `max(6, 9 - elapsed × 0.03)` units; obstacles per row `min(5, 2 + floor(elapsed / 15))`; a breather (no obstacles, stars only) of 100 units after every 450 units.
- **Look:** the default track is a see-through glowing purple road, and the rainbow look stays available as a second style. The sky has no fluffy clouds.

## Review Focus

1. **Doing nothing (AFK) must lose.** A rider who never steers is hit within 600 units. Pinned in Task 3: `a rider who never steers gets hit`.
2. **A bump while blinking, or hearts at full lives.** No extra life is lost while blinking, and a heart at 5 lives still scores. Pinned in Task 4.
3. **Obstacles appearing out of nowhere.** New track (and its obstacles) only appears deep in fog. Pinned in Task 1: `track never curls back within 150 units`.
4. **The safe lane is always passable**, including with rolling planets. Pinned in Task 2: `planets stay on one side of the safe lane` and `every row leaves the safe lane clear`.
5. **Restarting after game over.** A new ride starts with 3 lives, no blinking, no hit flash and no old obstacles. Checked by hand in Task 6, step 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `js/track.js` | adds the no-curl-back rule to section picking |
| `js/placement.js` | new: rows, safe lane, obstacles, stars, hearts, planets, breathers (no Three.js) |
| `js/collision.js` | new: swept hit and near-miss test, rolling planet motion (no Three.js) |
| `js/lives.js` | new: lives, the safety blink, healing (no Three.js) |
| `js/scoring.js` | adds `NEAR_MISS_POINTS = 5` |
| `js/trackMesh.js` | adds `PURPLE_STYLE` and `RAINBOW_STYLE`; glass road material |
| `js/sky.js` | replaces sky clouds with planets, nebula glows, comets and shooting stars |
| `js/models.js` | adds `makeRollingPlanet()` and `obstacleModel(kind)` |
| `js/main.js` | spawns placements, collisions, lives HUD, hit feedback, game over; removes End ride |
| `index.html` | lives pill back in the HUD; End ride button removed |
| `tests/*.test.js` | one test file per module above |

---

### Task 1: Track never curls back (no pop-in)

**Files:**
- Modify: `js/track.js` (`pickSection`)
- Test: `tests/track.test.js`

**Interfaces:**
- Produces: no API change. `createTrack` keeps its signature.

- [ ] **Step 1: Write the failing test**

```js
test('track never curls back within 150 units', ...)
// seeds 21, 22, 23, difficulty () => 1: for s = 0..20000 step 5,
// distance(frameAt(s), frameAt(s + 150)) >= 120
```

- [ ] **Step 2: Run it to check it fails**

Run: `npm test`
Expected: FAIL. On at least one seed, the distance drops below 120.

- [ ] **Step 3: Implement the rule in `pickSection`**

Remember the heading of the last 100 frames. When the net heading change over that window is more than 0.9 rad in one direction, the next section's turn is either straight or the opposite way. Tune the 0.9 if the test still fails. All existing track tests must stay green.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Keep the track from curling back into view"`

### Task 2: Placement

**Files:**
- Create: `js/placement.js`
- Test: `tests/placement.test.js`

**Interfaces:**
- Consumes: `createTrack`, `crestLift` (Task 1 and stage 1), `createRng` from `js/rng.js`, and `RIDER_LIMIT` from `js/riding.js`.
- Produces:
  - `KIND_RADIUS = { moonRock: 1.0, toadstool: 0.9, snowman: 0.6, crystalPine: 0.85, fairyHouse: 0.85, stormCloud: 0.95, planet: 0.7 }`. These are the largest sizes each model may have.
  - `OBSTACLE_KINDS = ['crystalPine', 'toadstool', 'moonRock', 'snowman', 'fairyHouse', 'stormCloud']`.
  - `EASY = { hearts: true, startGap: 9, minGap: 6, gapShrink: 0.03, startCount: 2, maxCount: 5, countEvery: 15, planetsAfter: 30, planetChance: 0.2 }`.
  - `FREE_RIDE = { free: true }`.
  - `createPlacer({ seed: number, track, mode = EASY })` returns `{ fill(sMax: number, elapsed: number): Placement[] }`. It returns the new placements for every row with `s <= sMax`. With `FREE_RIDE` it always returns `[]`.
  - `Placement = { type: 'obstacle' | 'planet' | 'star' | 'heart', kind?: string, s: number, x: number, radius: number, row: number, safeX: number, range?: [number, number] }`.

- [ ] **Step 1: Write the failing tests**

Each test uses `createTrack({ seed, difficulty: () => 1 })` and fills to 6000 with `elapsed = s / 11` unless it says otherwise.

```js
test('nothing before s = 40', ...)
test('every row leaves the safe lane clear', ...)        // obstacles/planets: |x - safeX| >= radius + 1.3
test('safe lane steps at most 1.2 per row', ...)
test('obstacles in a row do not overlap', ...)          // |xi - xj| >= ri + rj + 0.3
test('everything stays on the track', ...)              // |x| + radius <= TRACK_HALF_WIDTH - 0.1 for obstacles; |x| <= RIDER_LIMIT for pickups
test('no obstacles just after a crest', ...)            // no obstacle s with crestLift > 0.3 anywhere in [s - 12, s]
test('breathers leave 100 obstacle-free units after every 450', ...)
test('stars on about a quarter of rows, in the safe lane', ...) // share of rows with a star in 0.18..0.35; star x === safeX
test('hearts only when the mode allows', ...)           // hearts:false -> 0; EASY -> 1%..6% of rows
test('planets stay on one side of the safe lane', ...)  // range fully on one side, with clearance radius + 1.3; none before elapsed 30
test('rows get closer and fuller the longer you ride', ...) // average gap and count at elapsed 0 vs 120
test('same seed gives the same placements', ...)
test('free ride places nothing', ...)                   // createPlacer({ seed, track, mode: FREE_RIDE }).fill(6000, 500) -> []
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because `js/placement.js` is missing.

- [ ] **Step 3: Implement `js/placement.js`**

The row loop:
1. Advance by the gap and step the safe lane.
2. Decide whether this row is a breather, using `(s mod 550) >= 450`.
3. Place the star, star trail or heart in the safe lane.
4. Unless it's a breather or within 12 units after a crest, place up to `count` obstacles. Pick each kind from `OBSTACLE_KINDS`, try up to 8 positions, and keep the clearance and spacing rules.
5. After `planetsAfter`, with `planetChance`, add a planet. Its range lies on the side of the safe lane with more room.

For "after a crest": skip obstacles at `s` if `crestLift` exceeds 0.3 at any whole unit in `[s - 12, s]`.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Place obstacles, stars and hearts with a safe lane"`

### Task 3: Collision and rolling planets

**Files:**
- Create: `js/collision.js`
- Modify: `js/scoring.js` (add `NEAR_MISS_POINTS = 5`)
- Test: `tests/collision.test.js`, `tests/scoring.test.js`

**Interfaces:**
- Consumes: `Placement` and `createPlacer` (Task 2).
- Produces:
  - `RIDER_HALF = 0.35`, `NEAR_MISS = 0.4`.
  - `sweptCheck(item: { s, x, radius }, prevS: number, s: number, riderX: number) => 'hit' | 'near' | null`.
  - `planetX(range: [number, number], t: number, speed = 2) => number`: a triangle wave inside the range.

- [ ] **Step 1: Write the failing tests**

```js
test('hit when the board passes right through', ...)    // item {s:10,x:0,radius:0.6}, prevS 9.8, s 10.1, riderX 0.5 -> 'hit'
test('near miss just outside reach', ...)               // riderX = 0.6 + 0.35 + 0.2 -> 'near'
test('nothing when far away sideways', ...)             // riderX = 3 -> null
test('nothing before or after the board reaches it', ...) // prevS 5, s 6 -> null; prevS 11, s 12 -> null
test('a fast frame cannot skip over an obstacle', ...)  // prevS 9, s 11 (one 0.05 s frame at 40 u/s), riderX 0 -> 'hit'
test('planets roll within their range', ...)            // over t = 0..60 step 0.01: range[0] <= planetX <= range[1], and it reaches both ends
test('a rider who never steers gets hit', ...)
// track seed 31, placer EASY; walk s from 0 to 600 in steps of 0.2 with riderX 0
// (planets use planetX at t = s / 11); at least one 'hit'

// tests/scoring.test.js
test('near miss counts as a catch worth 5 times the combo', ...) // fresh scoring: addCatch(NEAR_MISS_POINTS) -> score 5, combo 1
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because `js/collision.js` and `NEAR_MISS_POINTS` are missing.

- [ ] **Step 3: Implement `js/collision.js` and add the constant**

`sweptCheck`: the item is reached when `item.s > prevS - 0.6 && item.s <= s + 0.4`. Then `gap = |item.x - riderX| - item.radius - RIDER_HALF`: a gap below 0 is a hit, below `NEAR_MISS` is a near miss.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add hit, near-miss and rolling planet maths"`

### Task 4: Lives

**Files:**
- Create: `js/lives.js`
- Test: `tests/lives.test.js`

**Interfaces:**
- Produces:
  - `SAFE_TIME = 1.5`.
  - `createLives({ start = 3, max = 5 } = {})` returns `{ lives, safe (seconds left), isSafe(), hit() => { lost: boolean, gameOver: boolean }, heal() => boolean (true if a life was added), tick(dt) }`.

- [ ] **Step 1: Write the failing tests**

```js
test('starts with 3 lives', ...)
test('a hit takes a life and gives 1.5 s of safety', ...)
test('hits while safe are ignored', ...)               // hit, hit -> lives 2, second returns { lost: false }
test('safety wears off', ...)                          // hit, tick(1.6), hit -> lives 1
test('game over at 0 lives', ...)                      // three spaced hits -> last returns gameOver true
test('hearts heal up to 5 and no further', ...)        // heal x3 -> 5; heal() returns false at 5
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because `js/lives.js` is missing.

- [ ] **Step 3: Implement `js/lives.js`**

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add lives with a safety blink"`

### Task 5: Space look: purple glass track and planets in the sky

**Files:**
- Modify: `js/trackMesh.js`, `js/sky.js`, `js/models.js`
- Test: `tests/trackMesh.test.js`, `tests/sky.test.js`, `tests/models.test.js` (new, using the same `document` stand-in as `sky.test.js`)

**Interfaces:**
- Produces:
  - `PURPLE_STYLE = { road: 'glass', color: 0x8a4dff, opacity: 0.45, wallColor: 0xff77ff }` and `RAINBOW_STYLE = { road: 'stripes', colors: [...6 rainbow colours], wallColor: 0xff77ff }`, exported from `trackMesh.js`. `buildChunk` and `createTrackView` accept either.
  - `sky.js` builds meshes named `'planet'` (at least 3, some with rings), additive nebula sprites, comets that cross slowly, and occasional shooting-star streaks. It no longer uses `makeSkyCloud`.
  - `models.js`: `makeRollingPlanet()` returns `{ geo, radius }` (a banded low-poly sphere with a ring, radius ≤ `KIND_RADIUS.planet`). `obstacleModel(kind)` returns `{ object: THREE.Group, radius }`, picking a cached random variant of that kind (5 variants each, built on first use). Storm clouds include the lightning bolt, and fairy houses include the window glow.

- [ ] **Step 1: Write the failing tests**

```js
// tests/trackMesh.test.js
test('purple glass road lets space show through', ...)  // buildChunk(track,0,50,PURPLE_STYLE): ribbon material transparent, opacity < 0.8, depthWrite false
test('rainbow style still builds', ...)                 // buildChunk(track,0,50,RAINBOW_STYLE) has 'ribbon'
// tests/sky.test.js
test('sky has planets and no clouds', ...)              // >= 3 objects named 'planet' anywhere in the scene graph; none named 'sky-cloud'
// tests/models.test.js
test('every obstacle model fits inside its placement radius', ...) // 20 obstacleModel(kind) per kind: radius <= KIND_RADIUS[kind]; also planet
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL. `PURPLE_STYLE`, `obstacleModel` and the planets are missing.

- [ ] **Step 3: Implement the space look**

- **Glass road:** a `MeshBasicMaterial` in the style colour, transparent (`opacity` from the style), `depthWrite: false`, double-sided. Add a soft brighter band along each edge (a narrow strip just inside the wall) so the track edges read clearly.
- **Planets:** low-poly flat-shaded spheres with colour bands, some with tilted rings, placed 150 to 260 units away in the `far` group with `fog: false`.
- **Nebulae:** large, additive, coloured glow sprites (pink, teal, violet) at a low opacity.
- **Comets:** a glowing head with a fading tail sprite, drifting across the sky.
- **Shooting stars:** a short-lived streak about every 4 to 8 s.
- **Model radii:** clamp each obstacle variant's random scale so its radius stays within `KIND_RADIUS`.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Purple glass track and a sky full of planets"`

### Task 6: Obstacles in the game

**Files:**
- Modify: `js/main.js`, `index.html`, `README.md`

**Interfaces:**
- Consumes: `createPlacer`, `EASY`, `KIND_RADIUS` (Task 2); `sweptCheck`, `planetX` (Task 3); `createLives` (Task 4); `PURPLE_STYLE`, `obstacleModel`, `makeRollingPlanet` (Task 5); `NEAR_MISS_POINTS`, `HEART_POINTS`, `STAR_POINTS` (scoring).

- [ ] **Step 1: Wire placements into the ride**

- Replace stage 1's scattered stars with `placer.fill(ride.s + 150, elapsed)` each frame.
- Turn each placement into an object, positioned and oriented on the track frame. Snowmen and fairy houses face the rider; storm clouds float at 1.4 and bob; planets roll using `planetX(range, elapsed)`.
- Shrink obstacles away once they are 0.5 units behind the rider, and remove them 5 units behind.
- Start each ride with a new `seed` for both the track and the placer.

- [ ] **Step 2: Hits, near misses, lives and game over**

- Run `sweptCheck` each frame against every unhit placement.
- **Hit, when not safe:** take a life (`lives.hit()`), reset the combo (`scoring.bump()`), play the edge flash (`#hit-flash`), a 0.3 shake, the 'hurt' sound and a lilac burst. The board blinks while `lives.isSafe()`.
- **Near miss:** `addCatch(NEAR_MISS_POINTS)`, a small white sparkle at the obstacle and a soft whoosh (a filtered noise or sine sweep from 900 Hz to 300 Hz over 0.15 s). Count each obstacle only once.
- **Star and heart:** as in stage 1. A heart also calls `lives.heal()`.
- **Game over** at 0 lives, using the existing screen.
- Remove the End ride button and the Escape shortcut.
- Show the lives pill (❤️ × lives).
- On window `blur`, release the held keys.
- Use a portrait field of view of 90°.

- [ ] **Step 3: Add Free Ride**

- The start screen gets a second button, `Free Ride 🌌` (id `free-btn`), next to `Ride! 🌈`.
- Free Ride uses `FREE_RIDE` for the placer and skips scoring, lives and collisions.
- The HUD hides the score, combo and lives pills, and shows a small `Menu ⏏` button (id `menu-btn`, top-right).
- `Menu` or Escape returns to the start screen, with no game-over screen and nothing saved.
- Speed follows the normal Easy curve, so the ride still builds up.

- [ ] **Step 4: Run the unit tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Play-test in the browser** (pane visible)

Check each of these:
- Obstacles of every kind appear in the distance, sitting on the track and leaning with it.
- With no input at all, the ride ends within about 60 to 90 seconds.
- A test autopilot that steers to `safeX` survives 60 seconds with no hits.
- A hit flashes the screen, removes a heart and blinks the board, and bumps during the blink cost nothing.
- Near misses sparkle and add points.
- Planets roll on one side only.
- The glass road shows stars through it, and the sky shows planets, nebulae and comets, with no clouds.
- After game over, "Ride Again" starts with 3 lives and a clean track.
- The phone view (375×812) shows obstacles in good time.
- The console shows no errors.
- **Free Ride:** no obstacles, stars, hearts, score or lives appear for 60 seconds; `Menu` and Escape return to the start screen; the leaderboard is unchanged afterwards.

- [ ] **Step 6: Commit** — `git commit -m "Obstacles that cost lives, near misses, game over and Free Ride"`

- [ ] **Step 7: Owner play-test and push**

The owner plays it on their computer. Push to `main` (the live site) only after they say go.
