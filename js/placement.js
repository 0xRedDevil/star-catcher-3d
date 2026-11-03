// What goes where on the track: rows of obstacles around a winding safe lane,
// with stars, hearts and rolling planets. Pure maths, no Three.js.
import { createRng } from './rng.js';
import { RIDER_LIMIT } from './riding.js';
import { TRACK_HALF_WIDTH } from './track.js';

// The largest each model may be, for spacing and hits
export const KIND_RADIUS = {
    rock: 1.0,
    cluster: 0.9,
    buddy: 0.6,
    tall: 0.85,
    station: 0.85,
    floater: 0.95,
    planet: 0.7,
};
export const PLACE_AHEAD = 150;   // things are placed this far ahead of the rider, deep in the fog
export const OBSTACLE_KINDS = ['tall', 'cluster', 'rock', 'buddy', 'station', 'floater'];

export const EASY = {
    hearts: true,
    startGap: 9,        // units between rows at the start
    minGap: 6,
    gapShrink: 0.03,    // gap lost per second of riding
    startCount: 2,      // obstacles per row at the start
    maxCount: 5,
    countEvery: 15,     // seconds per extra obstacle in a row
    planetsAfter: 30,   // seconds before rolling planets appear
    planetChance: 0.2,
};
export const HARD = {
    hearts: false,
    startGap: 8,
    minGap: 5,
    gapShrink: 0.04,
    startCount: 3,
    maxCount: 6,
    countEvery: 12,
    planetsAfter: 20,
    planetChance: 0.25,
};
export const FREE_RIDE = { free: true };

const FIRST_ROW = 40;
const SAFE_STEP = 1.2;
const SAFE_CLEAR = 1.3;
const SPACING = 0.3;
const CREST_GUARD = 12;
const CREST_LIMIT = 0.3;
const BREATHER_EVERY = 550;
const BREATHER_LENGTH = 100;
const TRAIL_CHANCE = 0.07;
const STAR_CHANCE = 0.18;
const HEART_CHANCE = 0.03;
const TRAIL_SPACING = 1.6;
const PICKUP_RADIUS = 0.8;
const EDGE = TRACK_HALF_WIDTH - 0.1;
const TRIES = 8;
const CLOUD_DRIFT = 1.5;   // storm clouds drift up to this far either side of where they start
// No camping: a rider who stays within CAMP_WIDTH of one spot for CAMP_DISTANCE units
// gets an obstacle placed in their lane (never in the safe lane), at most every NUDGE_GAP units
const CAMP_WIDTH = 1.0;
const CAMP_DISTANCE = 80;
const NUDGE_GAP = 40;
const NUDGE_KINDS = ['rock', 'buddy', 'cluster', 'tall', 'station'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Sideways distance from x to an obstacle, allowing for the whole of a drifting cloud's path
function gapTo(p, x) {
    if (!p.range) return Math.abs(p.x - x);
    return x < p.range[0] ? p.range[0] - x : x > p.range[1] ? x - p.range[1] : 0;
}

export function createPlacer({ seed, track, mode = EASY }) {
    if (mode.free) return { fill: () => [], noteRider: () => {} };

    const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
    const rand = (a, b) => a + rng() * (b - a);
    let nextS = FIRST_ROW;
    let row = 0;
    let safeX = 0;

    // Where the rider has been sitting, to spot camping
    let campAnchor = null;
    let campSince = 0;
    let campX = null;        // set while the rider is camping
    let lastNudgeS = -Infinity;

    function noteRider(s, x) {
        if (campAnchor === null || Math.abs(x - campAnchor) > CAMP_WIDTH) {
            campAnchor = x;
            campSince = s;
        }
        campX = s - campSince >= CAMP_DISTANCE ? x : null;
    }

    // Something just over a hilltop can't be seen coming, so keep that stretch clear
    function hiddenByCrest(s) {
        for (let u = Math.floor(s - CREST_GUARD); u <= Math.floor(s); u++) {
            if (track.crestLift(u) > CREST_LIMIT) return true;
        }
        return false;
    }

    function placeRow(s, elapsed) {
        const out = [];
        let step = rand(-SAFE_STEP, SAFE_STEP);
        // Camping on the safe lane itself: the lane drifts away, so following it means moving
        if (campX !== null && Math.abs(campX - safeX) < 2.6) step = -Math.sign(campX - safeX || 1) * rand(0.6, SAFE_STEP);
        safeX = clamp(safeX + step, -RIDER_LIMIT + 1, RIDER_LIMIT - 1);
        const tag = { row, safeX };

        // Stars and hearts wait in the safe lane
        const r = rng();
        if (r < TRAIL_CHANCE) {
            for (let i = 0; i < 3; i++) out.push({ type: 'star', s: s + i * TRAIL_SPACING, x: safeX, radius: PICKUP_RADIUS, ...tag });
        } else if (r < TRAIL_CHANCE + STAR_CHANCE) {
            out.push({ type: 'star', s, x: safeX, radius: PICKUP_RADIUS, ...tag });
        } else if (mode.hearts && r < TRAIL_CHANCE + STAR_CHANCE + HEART_CHANCE) {
            out.push({ type: 'heart', s, x: safeX, radius: PICKUP_RADIUS, ...tag });
        }

        const breather = s % BREATHER_EVERY >= BREATHER_EVERY - BREATHER_LENGTH;
        if (!breather && !hiddenByCrest(s)) {
            const count = Math.min(mode.maxCount, mode.startCount + Math.floor(elapsed / mode.countEvery));
            const placed = [];
            for (let i = 0; i < count; i++) {
                const kind = OBSTACLE_KINDS[Math.floor(rng() * OBSTACLE_KINDS.length)];
                const radius = KIND_RADIUS[kind];
                for (let t = 0; t < TRIES; t++) {
                    const x = rand(-(EDGE - radius), EDGE - radius);
                    if (Math.abs(x - safeX) < radius + SAFE_CLEAR) continue;
                    if (placed.some(p => gapTo(p, x) < p.radius + radius + SPACING)) continue;
                    const obstacle = { type: 'obstacle', kind, s, x, radius, ...tag };
                    if (kind === 'floater') {
                        // Floaters (storm clouds, UFOs) drift side to side, but only on their own side of the safe lane,
                        // and never into anything else in their row
                        let lo = x < safeX ? -(EDGE - radius) : safeX + radius + SAFE_CLEAR;
                        let hi = x < safeX ? safeX - radius - SAFE_CLEAR : EDGE - radius;
                        for (const p of placed) {
                            const keep = p.radius + radius + SPACING;
                            if (p.x < x) lo = Math.max(lo, (p.range ? p.range[1] : p.x) + keep);
                            else hi = Math.min(hi, (p.range ? p.range[0] : p.x) - keep);
                        }
                        const range = [Math.max(lo, x - CLOUD_DRIFT), Math.min(hi, x + CLOUD_DRIFT)];
                        if (range[1] - range[0] < 1) continue; // too cramped to drift here
                        obstacle.range = range;
                    }
                    placed.push(obstacle);
                    out.push(obstacle);
                    break;
                }
            }

            // No camping: put something in the camper's lane, unless something is already there
            if (campX !== null && s - lastNudgeS >= NUDGE_GAP) {
                const reaches = (p) => gapTo(p, campX) < p.radius * 0.9 + 0.35;
                const kind = NUDGE_KINDS[Math.floor(rng() * NUDGE_KINDS.length)];
                const radius = KIND_RADIUS[kind];
                const x = clamp(campX, -(EDGE - radius), EDGE - radius);
                if (placed.some(reaches)) {
                    lastNudgeS = s;
                } else if (Math.abs(x - safeX) >= radius + SAFE_CLEAR) {
                    // Make room by moving out anything it would overlap
                    for (const p of placed.filter(q => gapTo(q, x) < q.radius + radius + SPACING)) {
                        placed.splice(placed.indexOf(p), 1);
                        out.splice(out.indexOf(p), 1);
                    }
                    const nudge = { type: 'obstacle', kind, s, x, radius, nudge: true, ...tag };
                    placed.push(nudge);
                    out.push(nudge);
                    lastNudgeS = s;
                }
            }
        }

        // Rolling planets sit between rows, on the roomier side of the safe lane.
        // Extra clearance covers the lane moving on to the next row.
        const planetS = s + 3;
        if (elapsed >= mode.planetsAfter && rng() < mode.planetChance
            && planetS % BREATHER_EVERY < BREATHER_EVERY - BREATHER_LENGTH && !hiddenByCrest(planetS)) {
            const radius = KIND_RADIUS.planet;
            const clear = radius + SAFE_CLEAR + SAFE_STEP;
            const leftEnd = safeX - clear;
            const rightEnd = safeX + clear;
            const leftRoom = leftEnd - (-(EDGE - radius));
            const rightRoom = (EDGE - radius) - rightEnd;
            if (Math.max(leftRoom, rightRoom) >= 1.5) {
                const range = leftRoom >= rightRoom ? [-(EDGE - radius), leftEnd] : [rightEnd, EDGE - radius];
                out.push({ type: 'planet', kind: 'planet', s: planetS, x: (range[0] + range[1]) / 2, radius, range, ...tag });
            }
        }

        row++;
        return out;
    }

    function fill(sMax, elapsed) {
        const out = [];
        while (nextS <= sMax) {
            out.push(...placeRow(nextS, elapsed));
            nextS += Math.max(mode.minGap, mode.startGap - elapsed * mode.gapShrink);
        }
        return out;
    }

    return { fill, noteRider };
}
