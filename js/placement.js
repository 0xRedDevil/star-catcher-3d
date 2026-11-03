// What goes where on the track: rows of obstacles around a winding safe lane,
// with stars, hearts and rolling planets. Pure maths, no Three.js.
import { createRng } from './rng.js';
import { RIDER_LIMIT } from './riding.js';
import { TRACK_HALF_WIDTH } from './track.js';

// The largest each model may be, for spacing and hits
export const KIND_RADIUS = {
    moonRock: 1.0,
    toadstool: 0.9,
    snowman: 0.6,
    crystalPine: 0.85,
    fairyHouse: 0.85,
    stormCloud: 0.95,
    planet: 0.7,
};
export const PLACE_AHEAD = 150;   // things are placed this far ahead of the rider, deep in the fog
export const OBSTACLE_KINDS =['crystalPine', 'toadstool', 'moonRock', 'snowman', 'fairyHouse', 'stormCloud'];

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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createPlacer({ seed, track, mode = EASY }) {
    if (mode.free) return { fill: () => [] };

    const rng = createRng((seed ^ 0x5bd1e995) >>> 0);
    const rand = (a, b) => a + rng() * (b - a);
    let nextS = FIRST_ROW;
    let row = 0;
    let safeX = 0;

    // Something just over a hilltop can't be seen coming, so keep that stretch clear
    function hiddenByCrest(s) {
        for (let u = Math.floor(s - CREST_GUARD); u <= Math.floor(s); u++) {
            if (track.crestLift(u) > CREST_LIMIT) return true;
        }
        return false;
    }

    function placeRow(s, elapsed) {
        const out = [];
        safeX = clamp(safeX + rand(-SAFE_STEP, SAFE_STEP), -RIDER_LIMIT + 1, RIDER_LIMIT - 1);
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
                    if (placed.some(p => Math.abs(p.x - x) < p.radius + radius + SPACING)) continue;
                    const obstacle = { type: 'obstacle', kind, s, x, radius, ...tag };
                    placed.push(obstacle);
                    out.push(obstacle);
                    break;
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

    return { fill };
}
