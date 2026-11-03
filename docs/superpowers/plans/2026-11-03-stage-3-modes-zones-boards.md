# Stage 3: Modes, Zones and Epic Boards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Easy and Hard modes with their own leaderboards and best scores, named zones along the track (the rainbow road becomes the special zone), score-based board unlocks with boards that look epic, and the full start and game-over flow from the spec.

**Architecture:** As before, the logic lives in Three.js-free modules tested with `node --test`:
- `storage.js`: saved scores, bests, unlocks and choices, plus the one-time migration.
- `modes.js`: the Easy and Hard settings.
- `zones.js`: which zone you're in.
- `boards.js`: which boards a score unlocks.

Visual pieces are Three.js modules: zone track styles in `trackMesh.js` and epic boards in `boardModels.js`. `main.js` and `index.html` wire up the screens.

**Tech Stack:** Three.js 0.160.0 (CDN in the browser, dev dependency for tests), Node 20 `node:test`, plain ES modules, no build step.

**Spec:** `docs/superpowers/specs/2026-11-03-star-catcher-3d-design.md`

## Global Constraints

- Everything in the stage 1 and 2 Global Constraints still applies.
- **Easy:** 3 lives, hearts up to 5. Speed starts at 11, grows +0.15/s, caps at 22. Placement is the existing `EASY`.
- **Hard:** 3 lives, no hearts. Speed starts at 13, grows +0.25/s, caps at 28. Placement is `HARD = { hearts: false, startGap: 8, minGap: 5, gapShrink: 0.04, startCount: 3, maxCount: 6, countEvery: 12, planetsAfter: 20, planetChance: 0.25 }`.
- **Separate per mode:** top 5 and best score. The last mode played is remembered.
- **Board unlocks:** Candy at 2,000, Galaxy at 5,000 and Super Rainbow at 10,000, each scored in one run, in either mode. Unlocks are permanent and cosmetic.
- **Migration:** the old `star_catcher_3d_leaderboard` moves into Easy once, only if the Easy board doesn't exist yet. It never unlocks boards.
- **Storage:** every access is wrapped. If storage is missing or throws, the game still runs, keeping everything in memory.
- **Zones** (each 600 units, then the cycle repeats with "II", "III"…): Starlight Sea (purple glass) → Candy Nebula (pink glass) → Crystal Galaxy (icy blue glass) → Rainbow Moon (the rainbow road).
- **Boards** look epic, and more so with each tier:
  - every unlocked board has something moving;
  - Super Rainbow has stars orbiting it and a rainbow glitter trail;
  - the first ride on a newly unlocked board gets a celebration.
- **No copying:** no names, art or layouts from Mario Kart or Snow Rider.

## Review Focus

1. **Storage unavailable** (private browsing, blocked storage): the game starts, plays and shows leaderboards for that session. Pinned in Task 1: `works without storage` and `survives storage that throws`.
2. **Migration runs exactly once** and never unlocks boards, even when the old scores are high. Pinned in Task 1.
3. **Hard mode never shows a heart.** Pinned in Task 2: `hard places no hearts`.
4. **A locked board can never be selected**, including from a stale saved choice. Pinned in Task 1: `a saved board that isn't unlocked falls back to the starter`.
5. **An unlock mid-run is saved immediately**, so it survives closing the tab before game over. Pinned in Task 1: `unlocks are saved as soon as they happen`; wired in Task 5.

---

## File Structure

| File | Responsibility |
|---|---|
| `js/storage.js` | new: per-mode leaderboards and bests, unlocks, chosen board, last mode, migration (no Three.js) |
| `js/modes.js` | new: Easy and Hard settings (speed, lives, hearts, placement) (no Three.js) |
| `js/placement.js` | adds `HARD` |
| `js/zones.js` | new: the zone list and `zoneAt(s)` (no Three.js) |
| `js/boards.js` | new: the board list and `unlocksFor(score)` (no Three.js) |
| `js/trackMesh.js` | `createTrackView` takes a style per chunk; zone styles |
| `js/boardModels.js` | new: the four boards, with their animation, aura, trail colours and orbiting stars |
| `js/models.js` | the old `createBoard` moves out to `boardModels.js` |
| `js/main.js`, `index.html` | mode buttons, board picker, per-mode leaderboards, HUD best, zone toast, NEW BEST, unlock banner, celebration, game-over flow, sounds, sky tint |
| `tests/*.test.js` | one test file per new module |

---

### Task 1: Storage

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Produces:
  - `createStore(backing?)`. `backing` is `{ getItem, setItem }`. The default is `window.localStorage` when it's reachable; anything missing or throwing falls back to an in-memory map.
  - It returns:
    - `leaderboard(mode: 'easy' | 'hard') => Array<{ name, score }>`
    - `qualifies(mode, score) => boolean` (score > 0, and either fewer than 5 entries or above the lowest)
    - `addScore(mode, name, score) => void` (keeps the top 5)
    - `best(mode) => number`
    - `recordBest(mode, score) => boolean` (true if it's a new best)
    - `unlocked() => string[]` (always includes `'starter'`)
    - `unlock(ids: string[]) => string[]` (the newly unlocked ones, saved at once)
    - `board() => string`
    - `setBoard(id) => boolean` (refuses a locked id)
    - `lastMode() => 'easy' | 'hard'` and `setLastMode(mode)`
  - Keys: `sc3d_lb_easy`, `sc3d_lb_hard`, `sc3d_best_easy`, `sc3d_best_hard`, `sc3d_unlocked`, `sc3d_board`, `sc3d_mode`. The legacy key is `star_catcher_3d_leaderboard`.

- [ ] **Step 1: Write the failing tests**

```js
test('empty store starts clean', ...)                  // leaderboards [], bests 0, unlocked ['starter'], board 'starter', lastMode 'easy'
test('leaderboards and bests are kept per mode', ...)
test('top 5 only, highest first', ...)
test('qualifies needs a score above 0 and room or a higher score', ...)
test('recordBest only reports a new best', ...)
test('old leaderboard moves into Easy once', ...)      // legacy entries appear in Easy; Hard empty; after an Easy save a new store doesn't migrate again
test('migration never unlocks boards', ...)            // legacy score 50000 -> unlocked ['starter']
test('unlocks are saved as soon as they happen', ...)  // unlock(['candy']) then a fresh createStore on the same backing sees 'candy'
test('a saved board that isn't unlocked falls back to the starter', ...) // backing has sc3d_board 'rainbow' but not unlocked -> board() 'starter'; setBoard('galaxy') false
test('works without storage', ...)                     // createStore(null) works in memory
test('survives storage that throws', ...)              // a backing whose getItem/setItem throw: every call works
test('ignores corrupted saved data', ...)              // backing returns 'not json' -> defaults
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because `js/storage.js` is missing.

- [ ] **Step 3: Implement `js/storage.js`**

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Save scores, bests and unlocks per mode, with migration"`

### Task 2: Modes

**Files:**
- Create: `js/modes.js`
- Modify: `js/placement.js` (add `HARD`)
- Test: `tests/modes.test.js`

**Interfaces:**
- Consumes: `EASY`, `createPlacer` (placement.js).
- Produces:
  - `MODES = { easy: { id: 'easy', label: 'Easy', lives: 3, maxLives: 5, speed: { start: 11, growth: 0.15, max: 22 }, placement: EASY }, hard: { id: 'hard', label: 'Hard', lives: 3, maxLives: 3, speed: { start: 13, growth: 0.25, max: 28 }, placement: HARD } }`.
  - `speedAt(mode, elapsed) => number`.

- [ ] **Step 1: Write the failing tests**

```js
test('hard places no hearts', ...)                 // createPlacer with MODES.hard.placement over 6000 units -> 0 hearts
test('hard is faster and busier than easy', ...)   // speedAt at 0/60/600; average obstacles per row and rows per 1000 units
test('speed grows then stops at the cap', ...)     // speedAt(easy, 1000) === 22; speedAt(hard, 1000) === 28
test('easy keeps its hearts', ...)                 // easy placement has hearts > 0 over 6000 units
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because `js/modes.js` and `HARD` are missing.

- [ ] **Step 3: Implement `js/modes.js` and `HARD`**

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add Easy and Hard modes"`

### Task 3: Zones

**Files:**
- Create: `js/zones.js`
- Modify: `js/trackMesh.js`
- Test: `tests/zones.test.js`, `tests/trackMesh.test.js`

**Interfaces:**
- Consumes: `PURPLE_STYLE`, `RAINBOW_STYLE` (trackMesh.js).
- Produces:
  - In `js/zones.js`: `ZONE_LENGTH = 600` and `ZONES = [{ id, name, sky: hex, nebula: hex[] }…]` in the order Starlight Sea, Candy Nebula, Crystal Galaxy, Rainbow Moon. `zoneAt(s) => { index, zone, lap, name, startS }`, where the name gains " II", " III"… on later laps.
  - In `trackMesh.js`: `ZONE_STYLES` keyed by zone id: `starlight: PURPLE_STYLE`, `candy: { road: 'glass', color: 0xff6ec7, opacity: 0.45, edgeColor: 0xffd1ec, wallColor: 0xff9fd0 }`, `crystal: { road: 'glass', color: 0x4fc3ff, opacity: 0.45, edgeColor: 0xd0f2ff, wallColor: 0x7fe8ff }` and `rainbow: RAINBOW_STYLE`.
  - `createTrackView(track, scene, styleFor)`, where `styleFor` is either a style or `(s) => style`, decided by each chunk's start.

- [ ] **Step 1: Write the failing tests**

```js
// zones.test.js
test('zones go in order every 600 units', ...)    // zoneAt(0) starlight; 600 candy; 1200 crystal; 1800 rainbow
test('zones repeat with a lap number', ...)       // zoneAt(2400).name === 'Starlight Sea II'; zoneAt(5000).lap === 2
test('every zone has a track style', ...)         // ZONES.every(z => ZONE_STYLES[z.id])
// trackMesh.test.js
test('track view styles each chunk by its zone', ...) // createTrackView(track, scene, s => ZONE_STYLES[zoneAt(s).zone.id]); update to 1800; a chunk starting at 600 uses the candy road material, one at 1800 the rainbow road
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because `js/zones.js` and `ZONE_STYLES` are missing.

- [ ] **Step 3: Implement `js/zones.js` and the styling per chunk**

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Name zones along the track, each with its own road"`

### Task 4: Boards and epic board models

**Files:**
- Create: `js/boards.js`, `js/boardModels.js`
- Modify: `js/models.js` (remove `createBoard`; keep `roundedRect`, `BOARD_W` and `BOARD_L` exported for `boardModels.js`)
- Test: `tests/boards.test.js`, `tests/boardModels.test.js`

**Interfaces:**
- Produces:
  - In `js/boards.js`: `BOARDS = [{ id: 'starter', name: 'Starter Board', unlockScore: 0 }, { id: 'candy', name: 'Candy Board', unlockScore: 2000 }, { id: 'galaxy', name: 'Galaxy Board', unlockScore: 5000 }, { id: 'rainbow', name: 'Super Rainbow Board', unlockScore: 10000 }]` and `unlocksFor(score) => string[]`.
  - In `js/boardModels.js`: `createBoardModel(id) => { group: THREE.Group, update(dt, time): void, trailColors: THREE.Color[], trailRate: number, auraColor: number }`.
    - **Starter:** plain soft lilac with a small white star; one trail colour; trail rate 1.
    - **Candy:** pink and mint swirl that scrolls along the board, a soft pink aura that pulses, pink and white heart-sparkle trail; trail rate 2.
    - **Galaxy:** deep blue starfield texture that drifts and twinkles, a glowing cyan edge outline, star-dust trail in blue and white; trail rate 3.
    - **Super Rainbow:** rainbow stripes whose hues slide along the board, a pulsing white under-glow, 3 small gold stars orbiting the board, rainbow glitter trail; trail rate 5.

- [ ] **Step 1: Write the failing tests** (`boardModels.test.js` imports `./support/fake-document.js` first)

```js
test('unlock scores', ...)                              // unlocksFor(1999) ['starter']; 2000 + candy; 10000 all four
test('every board builds and animates', ...)            // for each id: group is Object3D; update(1/60, t) for 120 frames without throwing
test('each tier sparkles more than the last', ...)      // trailRate strictly increases starter < candy < galaxy < rainbow
test('the super rainbow board has orbiting stars', ...) // 3 children named 'orbit-star', whose positions change after update()
test('unlocked boards have something moving', ...)      // for candy/galaxy/rainbow, some material/texture/child transform differs before and after update()
```

- [ ] **Step 2: Run them to check they fail**

Run: `npm test`
Expected: FAIL, because the board modules are missing.

- [ ] **Step 3: Implement `js/boards.js` and `js/boardModels.js`**

The scrolling surfaces use `CanvasTexture` offset animation, guarded for Node like the road texture. Auras are additive glow sprites. The orbiting stars use `starGeo` scaled to 0.12 on a circle of radius 0.9 around the board centre, bobbing.

- [ ] **Step 4: Run the tests to check they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit** — `git commit -m "Add four boards, each more epic than the last"`

### Task 5: Screens, flow and feedback

**Files:**
- Modify: `js/main.js`, `index.html`, `README.md`

**Interfaces:**
- Consumes: Tasks 1 to 4, plus the existing scoring, lives and placement.

- [ ] **Step 1: Start screen**

- Three buttons: **Easy 🌈**, **Hard 🔥** and **Free Ride 🌌**. The last mode played is highlighted.
- A board picker: four cards, each with a CSS preview of the board's look and its name. Locked cards show 🔒 and "Score 2,000 to unlock". Tapping an unlocked card selects it, saves it and shows it on the moving board behind the menu.
- A top 5 with Easy and Hard tabs, defaulting to the last mode.

- [ ] **Step 2: During the ride**

- The HUD adds `Best: N` for the current mode. Free Ride keeps hiding the pills.
- When entering a zone (after the first), the zone name shows briefly in the centre with a soft chime.
- The background and fog colour blend to the zone's `sky` over about 40 units.
- Nebula sprites shift to the zone's colours.
- When the score first passes the mode's previous best (if that was above 0), "NEW BEST!" pops up once, with sparkles and a fanfare.
- When the score crosses an unlock score: `store.unlock` is called at once and a "NEW BOARD UNLOCKED!" banner shows with the board name and a fanfare. The ride continues.
- The first ride on a newly unlocked board starts with a sparkle burst and a "Riding the Galaxy Board!" banner. Track which boards have been celebrated in memory and in `sc3d_celebrated`.
- The board trail uses `trailColors` and `trailRate` from the chosen board, and its `update(dt, time)` runs each frame.

- [ ] **Step 3: Game over**

- Show the score, best combo and "You reached Crystal Galaxy!".
- Show name entry only when `store.qualifies(mode, score)`.
- Show that mode's leaderboard.
- **Ride Again** restarts the same mode and board in one tap. **Menu** returns to the start screen.
- `recordBest` is called on game over.
- Sounds: the chime is a two-note sine (880 Hz, then 1320 Hz, 0.12 s each). The fanfare is a rising triangle arpeggio (C5, E5, G5, C6, 0.1 s each).

- [ ] **Step 4: Run the unit tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Play-test in the browser** (pane visible)

Use a temporary test copy with an autopilot and a score cheat, deleted afterwards. Check each of these:
- Easy and Hard both start, Hard shows no hearts, and Hard is visibly faster and busier.
- The zone toast appears at 600, 1200 and 1800, and Rainbow Moon has the rainbow road.
- NEW BEST shows once.
- Crossing 2,000 shows the unlock banner, and the Candy card unlocks on the start screen.
- Choosing Galaxy or Super Rainbow shows its effects behind the menu and in the ride, including the orbiting stars and glitter trail.
- The first ride on a new board celebrates.
- Ride Again keeps the mode and board, and Menu works.
- The old live scores appear under Easy.
- Free Ride is unchanged.
- The phone view (375×812) fits the start screen with all buttons and the picker, scrolling if needed.
- The console shows no errors.

- [ ] **Step 6: Commit** — `git commit -m "Modes, zones, board unlocks and the full menu flow"`

- [ ] **Step 7: Owner play-test and push**

The owner plays it on their computer and checks that the unlock scores feel reachable but special. Push only after they say go.
