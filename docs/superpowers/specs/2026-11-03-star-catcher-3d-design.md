# Star Catcher 3D: Rainbow Sky Track — Design

Date: 2026-11-03
Status: draft for approval

## Intent

Star Catcher 3D is a browser game the owner is making for their young daughter (and to play with her). The first version, a fairy flying down a straight glowing path, was a hit. This redesign aims to give it the feel of Snow Rider 3D, the quick, addictive "one more go" downhill game, combined with the swooping thrill of a rainbow road floating in space that climbs, dips and banks around bends like a rollercoaster.

What makes it fun, in order:

1. **The ride itself**: speed, swooping over hills ("wheee" at the crest), leaning into bends, with stars all around so it feels like flying in space.
2. **Dodging**: near-misses with obstacles she can recognise.
3. **Chasing a number**: score, combo streaks, beating her best, reaching new zones, and unlocking new boards.

Collecting is a seasoning, not the main course. The owner explicitly asked for fewer stars and hearts than the previous version.

## Goals

- Feels like riding a rollercoaster-like rainbow track through space: hills, dips, banked curves, generated endlessly and randomly.
- Close, first-person-style view just behind a board that is visible in the lower part of the screen (like the sled in Snow Rider).
- Obstacles that are instantly recognisable, in several shapes and sizes.
- Always fair: there is always a way through, and nothing is hidden where she can't see it coming.
- Addictive loop: short runs, instant retry, visible best score, "NEW BEST!" moments, zones to reach, boards to unlock.
- Two modes: Easy (with hearts) and Hard (no hearts).
- Runs well on a mid-range tablet or phone and on desktop, as a single web page on GitHub Pages.

## Non-goals

- No online leaderboard, accounts or sharing. Scores and unlocks live in the browser on that device.
- No jumping or up/down control. The player steers left and right only.
- No music soundtrack in this version (simple sound effects only, as now).
- No build step or framework.
- The 2D game (fairy-star-catcher) is out of scope.

## Anti-goals (would be a failure even if it works)

- Copying Mario Kart's Rainbow Road or Snow Rider: no names, characters, art, track layouts or logos from either. The look stays this game's own: night space sky, moon, magic boards, pastel low-poly models.
- Unfair hits: obstacles appearing just over a hilltop or around a blind bend.
- Falling off the track or losing a life to a wall.
- Long menus or waits between runs.
- A camera that makes a child feel sick (too much roll or shake).
- Stuttering on a tablet.

## Constraints

- Static files in the `0xRedDevil/star-catcher-3d` repo, served by GitHub Pages from `main` at https://0xreddevil.github.io/star-catcher-3d/: `index.html` plus plain ES module files under `js/`, with no build step. *(Changed during planning from "single index.html" so the track maths can be unit-tested in Node. Three.js is a dev-only dependency for tests; the page still loads it from the CDN.)*
- Three.js 0.160.0 from jsDelivr through an import map (already in use), including `three/addons/` for `BufferGeometryUtils`.
- Touch (drag) and keyboard (arrow keys / A, D) controls. Touch must not scroll or zoom the page (`touch-action: none` on the canvas).
- `localStorage` for leaderboards, best scores, unlocks, last mode and selected board, wrapped in try/catch (the game must work if storage is unavailable).
- Commits are authored as `0xRedDevil <102221937+0xRedDevil@users.noreply.github.com>` (already set in the repo config). Pushing to `main` publishes the live site, so push only with the owner's go-ahead.

## Decided by the owner

- A winding rainbow track in space that goes up, down and around bends.
- A see-through magical wall along both edges, so you can't fall off and the stars stay visible.
- The view of Snow Rider: close behind the board, with the board visible.
- Recognisable obstacles of different shapes, like Snow Rider's snowmen, rocks and trees.
- Fewer stars and hearts than before.
- Two modes: **Easy**, where hearts can be collected, and **Hard**, with 3 lives and no hearts.
- Score-based board unlocks: plain starter board; new board at **2,000**; a nicer one at **5,000**; a super flashy rainbow board with glitter sparkles at **10,000**.
- Combo multiplier scoring with a small score for progress, giving the "high scoring" feel.

### Decided by the owner after playing stage 1

- **Track surface:** a see-through, glowing purple road (like the first 3D version's path), so space and stars show through it. The rainbow road is kept as a look for special rounds or zones only (stage 3).
- **Sky:** no fluffy clouds in the sky. Instead there are planets (some ringed), stars and other space things: coloured nebula glows, comets and shooting stars. Storm clouds stay as an obstacle on the track.
- **Obstacles must be able to end the ride.** Sitting still without steering must not be a way to survive.
- **Free Ride mode:** ride the track just to enjoy it: no obstacles, no stars or hearts, no score, no lives and no game over. It's started from its own button on the start screen, and a Menu button (or Escape) returns to the start screen. Nothing is saved to any leaderboard.

## Design (proposed by Claude, agreed in conversation)

### The track

The track is a ribbon generated a little at a time ahead of the rider and discarded behind.

- **Sampling:** the centreline is a list of frames, one per 1 unit of distance along the track (`s`). Each frame holds a position, a forward direction, a right direction (with bank applied) and an up direction.
- **Generator state:** heading (yaw), slope (pitch) and bank, plus the current targets for each.
- **Sections:** every 30 to 70 units the generator picks new targets:
  - a turn rate (yaw change per unit): straight, gentle or medium left/right. The largest allowed turn rate grows with difficulty, but the tightest radius never goes below about 25 units.
  - a slope: climb, dip or level, within about −0.25 to +0.2. A gentle pull back toward a home height keeps the track from drifting endlessly up or down.
- **Smoothing:** turn rate and slope ease toward their targets (e.g. exponential easing per unit) so there are never kinks.
- **Bank:** proportional to the turn rate, capped at about 25°, so the track leans into bends.
- **Width:** about 12 units, with the rider allowed about ±5.3 from the centre.
- **Mesh:** built in chunks (for example 40 to 60 units each) from the frames, with UVs running along the length so the surface texture can scroll and stripe. Keep about 150 units ahead and about 20 behind; dispose old chunks.
- **Walls:** low (about 0.8 units), translucent, glowing barriers along both edges, built from the same frames. Stars and space must be clearly visible through them.
- **No pop-in (added after the stage 1 review):** the track must not curl back on itself so tightly that new track gets built in clear view. Over any 150 units of track, the straight-line distance from start to end stays at least 120 units, so new pieces always appear deep in the fog.
- **Position precision:** long runs reach tens of thousands of units. If jitter appears, the builder may re-centre the world origin periodically.

### Riding and "physics for feel"

- **Pose:** the rider's position is the frame at distance `s`, offset sideways by `x` along the frame's right direction. The board takes the frame's orientation (including bank), plus a small extra lean from steering.
- **Speed:** a base speed rises over time (per mode, below). On top of that, downhill adds a little speed and uphill takes a little away (about ±15–20% at most), so dips feel fast.
- **Crest float:** where the track goes from climbing to dropping, the board and camera lift slightly for a moment, to make an airtime "wheee" feeling. This is visual only and doesn't affect hits.
- **Walls:** steering into a wall stops at the limit and gives a soft sparkle and a gentle push back. No life is lost.
- **Steering:** left/right moves `x` toward a target, smoothed as in the current game. Keys move the target at a steady rate. Dragging moves it by how far the finger moves (relative drag, already built). Curves should never require hard steering to stay on the track, because the walls handle that.

### Camera

- Just behind and above the board, following the track's frame so it rises, dips and turns with the track.
- The board fills roughly the lower third of the screen.
- It rolls with the bank, but gently (about half the track's bank), and shake on a bump is small and short.
- Field of view about 70° in landscape and wider in portrait, so phones still see enough of the track.
- **Decided by the owner after stage 3:** no wand in view; the board and the track speak for themselves.

### What's on the track

All models are low-poly and flat-shaded, each baked into one geometry with vertex colours (the helpers exist in the current draft).

| Obstacle | Notes |
|---|---|
| Moon rocks | Different shapes (icosahedron, dodecahedron, octahedron), sizes, single or pairs, with snowy tops. |
| Toadstools | Red with white spots, plus purple, pink, blue and orange caps; different heights. |
| Snowmen | Wizard hat, scarf, carrot nose; they face the rider. |
| Crystal trees | Tiered, in icy colours, with a little star on top. |
| Fairy houses | Glowing windows; they face the rider. |
| Storm clouds | Float at head height, with a lightning bolt. **Decided by the owner after stage 3:** they drift side to side to make them trickier, staying on their own side of the safe lane. |
| Rolling planets | Small ringed planets that roll side to side across the track and bounce off the walls. They start appearing later in a run. |

**Scenery** (no collisions), floating off the track in space: big planets with rings, comets and shooting stars, floating islands with little castles and trees, the moon, a starfield and glitter.

### Placement rules

- **Rows:** obstacles come in rows at a distance gap that shrinks as the run goes on (numbers per mode below).
- **Safe lane:** a hidden lateral position that random-walks by at most about ±1.2 units per row. No obstacle overlaps it (obstacle radius + 1.3 clearance).
- **Spacing:** obstacles in a row don't overlap each other (their radii + 0.3).
- **Density:** 2 obstacles per row at the start, rising to a cap.
- **Fairness:** don't place obstacles in the stretch just past a crest where the track drops out of sight (roughly 12 units), and use fewer obstacles on the sharpest bends.
- **Breathers:** roughly every 40 seconds, a calm stretch of about 8–10 seconds with no obstacles and a few stars.
- **Stars:** on about 1 row in 4, placed in the safe lane, sometimes as a short trail of 3.
- **Hearts:** Easy mode only, on about 3% of rows, in the safe lane.
- **Rolling planets:** after about 20 s (Hard) or 30 s (Easy), on about 20% of rows. *(Claude's call)* To keep the "always a way through" guarantee, a planet rolls back and forth only on one side of the safe lane: between that side's wall and a point just short of the safe lane's clearance. It never crosses the safe lane.

### Zones

The track passes through named zones every few hundred units, for example **Candy Nebula → Crystal Galaxy → Rainbow Moon**, then repeating with new colours or continuing with more names. Each zone changes the track's colours and stripe pattern, the wall glow colour, the sky tint and the floating scenery. Entering a zone shows its name briefly on screen. The game-over screen says which zone was reached.

### Scoring (starting values, to be tuned in play-testing)

- **Distance:** 1 point per 4 units travelled.
- **Star:** 10 × combo.
- **Heart (Easy):** 25 × combo, plus one life (max 5).
- **Near miss:** passing an obstacle within about 0.4 units of hitting it gives 5 × combo points and a sparkle.
- **Combo:** *(Claude's call)* stars, hearts **and near misses** all count as catches, so brave dodging builds the multiplier too, not only collecting. Every 3 catches in a row adds +1 to the multiplier, up to x5. Only a bump resets it; missing a star does not.
- **Tuning target:** the first unlock (2,000) arrives within a few good rides; 10,000 needs a really great run.

### Modes

| | Easy | Hard |
|---|---|---|
| Lives | 3, hearts restore up to 5 | 3, no hearts |
| Speed | starts around 11, grows slowly (about +0.15/s), cap about 22 | starts around 13, grows faster (about +0.25/s), cap about 28 |
| Density | gentler gaps and cap | tighter gaps, higher cap |
| Leaderboard | own top 5 and best | own top 5 and best |

The last mode played is remembered, so a retry is one tap.

### Boards and unlocks

| Board | Unlock | Look |
|---|---|---|
| Starter | from the start | plain soft lilac with a small white star |
| Candy | score 2,000 in one run | pink and mint stripes |
| Galaxy | score 5,000 in one run | deep blue with twinkling stars and a glowing edge |
| Super Rainbow | score 10,000 in one run | rainbow stripes, glitter sparkle trail, under-glow |

- A score in either mode counts toward unlocks.
- When an unlock happens mid-run, a "NEW BOARD UNLOCKED!" banner appears with sparkles and the run continues.
- The start screen shows all four boards. Locked ones show a padlock and the score needed. Tapping an unlocked board selects it, and the choice is remembered.
- Boards are cosmetic only.
- **Decided by the owner:** the unlocked boards must look *epic*, clearly more special than the starter board, with each tier more spectacular than the last. Every unlocked board has something moving: for example a shimmering animated surface, a glowing aura, its own sparkle trail and, at the top tier, little stars orbiting the board and a rainbow glitter trail. A board's first ride after unlocking it deserves a little celebration.

### Screens and flow

- **Start screen:** title, Easy and Hard buttons, board picker, and the top 5 for the selected mode. The sky and track keep moving gently behind it.
- **HUD:** score, best score for the mode, combo (shown only above x1), lives as hearts, and a brief zone-name toast. "NEW BEST!" pops up once when the best is passed mid-run.
- **Game over:** score, best combo, zone reached, name entry when the score makes the mode's top 5, the leaderboard, and a big "Ride again" button that restarts instantly in the same mode and board. A "Menu" button returns to the start screen.

### Feedback

- Sounds: star, heart and bump (as now), plus a soft whoosh for a near miss, a chime for a new zone, a fanfare for an unlock or new best, and a soft boing for a wall touch.
- Hit: red-pink edge flash, short small shake, the board blinks for about 1.5 s of safety, and the combo resets.

## Testing and release

- **Decided by the owner:** they play-test each version in a browser on their computer, then it gets pushed live. There's no separate preview site.
- The work ships in stages, each tested on the computer and pushed only with the owner's go-ahead:
  1. Track and riding: the generated track, walls, camera, board, steering, speed and crest float, with the existing scoring.
  2. Obstacles and placement: all obstacle types, safe lane, fairness rules, breathers, rolling planets, near misses.
  3. Modes, zones and unlocks: Easy/Hard, separate leaderboards and bests, zones, boards and unlock banners, game-over flow.
- Because the device isn't a tablet, the performance check is desktop Chrome plus the browser's phone-size view. The design still keeps to mobile-friendly techniques, since the live site is opened on phones and tablets too.

### Existing saved scores

- **Decided by the owner:** the live game's top 5 (stored under `star_catcher_3d_leaderboard`) moves into the **Easy** leaderboard the first time the new version loads.
- Old scores do **not** unlock boards. Unlocks need a score in the new game.
- If the Easy leaderboard already exists, don't migrate again.

## Current state

- **Live** (`main`, d6e9790): the first 3D version, a fairy flying along a straight glowing path.
- **Uncommitted in the working tree:** a draft first-person rewrite on a wide, flat, tilted slope. It is not approved as a design and the track system replaces its slope, but these pieces are worth reusing: the low-poly model baking helpers and obstacle makers, the rainbow board, the wand, the glitter, combo scoring, the leaderboard, audio, the HUD and hit flash, and relative-drag steering.

## Left to the builder

- Exact colours, model proportions, zone names beyond the first three, and how zone scenery differs.
- Sound design details.
- All numbers marked as starting values, tuned by play-testing against the goals above.
- Chunk sizes, generation look-ahead distances and performance techniques (instancing, merging, pooling), as long as it stays smooth on a mid-range tablet.
- Whether to re-centre the world origin on long runs.
