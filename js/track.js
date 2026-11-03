// The rainbow track: an endless centreline generated one unit at a time.
// Pure maths, no Three.js, so it can be tested in Node.
import { createRng } from './rng.js';

export const TRACK_HALF_WIDTH = 6;
export const MAX_YAW_RATE = 0.04;   // radians per unit: tightest bend has a radius of 25
export const MIN_SLOPE = -0.25;
export const MAX_SLOPE = 0.2;
export const MAX_BANK = 0.436;      // 25 degrees

const YAW_STEP = 0.004;             // most the turn rate may change per unit
const SLOPE_STEP = 0.02;            // most the slope may change per unit
const TURN_LEVELS = [0, 0, 0.4, 0.7, 1.0];
const HOME_BAND = 20;               // beyond this height the track heads back towards 0
const TURN_WINDOW = 100;            // units of heading history checked for curling back
const TURN_WINDOW_LIMIT = 0.9;      // most net turn (radians) allowed within that window

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createTrack({ seed, difficulty = () => 0, sections = null }) {
    const rng = createRng(seed);
    const script = sections ? sections.slice() : [];

    const frames = [];
    let first = 0;          // the s of frames[0]

    // Generator state
    let x = 0, y = 0, z = 0;
    let yaw = 0;
    let yawRate = 0;
    let slope = 0;
    let targetYawRate = 0;
    let targetSlope = 0;
    let sectionLeft = 0;
    const yawHistory = [];  // recent headings, so the track never curls back into view

    function recentTurn() {
        // The biggest swing in heading within the window, with the direction of the swing,
        // so an S-bend that swings hard one way then the other still counts
        let lo = yaw;
        let hi = yaw;
        for (const past of yawHistory) {
            lo = Math.min(lo, past);
            hi = Math.max(hi, past);
        }
        return yaw - lo > hi - yaw ? yaw - lo : yaw - hi;
    }

    function pickSection() {
        if (script.length) {
            const next = script.shift();
            sectionLeft = next.length;
            targetYawRate = next.yawRate;
            targetSlope = next.slope;
            return;
        }
        sectionLeft = 30 + Math.floor(rng() * 41);
        const level = TURN_LEVELS[Math.floor(rng() * TURN_LEVELS.length)];
        const side = rng() < 0.5 ? -1 : 1;
        targetYawRate = side * level * MAX_YAW_RATE * (0.5 + 0.5 * clamp(difficulty(), 0, 1));
        // After a lot of turning one way, go straight or turn back the other way
        const turned = recentTurn();
        if (Math.abs(turned) > TURN_WINDOW_LIMIT / 2 && Math.sign(targetYawRate) === Math.sign(turned)) {
            targetYawRate = -targetYawRate * 0.5;
        }

        targetSlope = MIN_SLOPE + rng() * (MAX_SLOPE - MIN_SLOPE);
        targetSlope -= clamp(y / 200, -0.1, 0.1);
        if (y > HOME_BAND) targetSlope = Math.min(targetSlope, -0.05);
        if (y < -HOME_BAND) targetSlope = Math.max(targetSlope, 0.05);
        targetSlope = clamp(targetSlope, MIN_SLOPE, MAX_SLOPE);
    }

    function makeFrame(s) {
        const pitch = Math.atan(slope);
        const cp = Math.cos(pitch);
        // Forward: yaw 0 points down -z, positive yaw turns towards +x (right)
        const fx = cp * Math.sin(yaw);
        const fy = Math.sin(pitch);
        const fz = -cp * Math.cos(yaw);

        // Unbanked right = forward x worldUp
        let rx = -fz, ry = 0, rz = fx;
        const rl = Math.hypot(rx, rz);
        rx /= rl;
        rz /= rl;

        // Lean into the bend: rotate right about forward (right edge dips on a right turn)
        const bank = clamp(yawRate / MAX_YAW_RATE * MAX_BANK, -MAX_BANK, MAX_BANK);
        const c = Math.cos(bank);
        const sn = Math.sin(bank);
        // forward x right
        const cx = fy * rz - fz * ry;
        const cy = fz * rx - fx * rz;
        const cz = fx * ry - fy * rx;
        const brx = rx * c + cx * sn;
        const bry = ry * c + cy * sn;
        const brz = rz * c + cz * sn;

        // Up = right x forward
        const ux = bry * fz - brz * fy;
        const uy = brz * fx - brx * fz;
        const uz = brx * fy - bry * fx;

        return { s, x, y, z, fx, fy, fz, rx: brx, ry: bry, rz: brz, ux, uy, uz, yawRate, slope, bank };
    }

    function generateNext() {
        if (frames.length === 0) {
            frames.push(makeFrame(0));
            return;
        }
        const prev = frames[frames.length - 1];
        x = prev.x + prev.fx;
        y = prev.y + prev.fy;
        z = prev.z + prev.fz;

        yawHistory.push(yaw);
        if (yawHistory.length > TURN_WINDOW) yawHistory.shift();
        // A bend that has turned too far ends early, so the next section can unwind it
        const turned = recentTurn();
        if (!script.length && Math.abs(turned) > TURN_WINDOW_LIMIT && Math.sign(targetYawRate) === Math.sign(turned)) {
            sectionLeft = 0;
        }

        if (sectionLeft <= 0) pickSection();
        sectionLeft--;
        yawRate += clamp(targetYawRate - yawRate, -YAW_STEP, YAW_STEP);
        slope += clamp(targetSlope - slope, -SLOPE_STEP, SLOPE_STEP);
        yaw += yawRate;

        frames.push(makeFrame(prev.s + 1));
    }

    function lastS() {
        return first + frames.length - 1;
    }

    function ensure(sMax) {
        const need = Math.ceil(sMax) + 1;
        while (frames.length === 0 || lastS() < need) generateNext();
    }

    function frameIndex(s) {
        return clamp(Math.floor(s) - first, 0, frames.length - 1);
    }

    function frameAt(s) {
        ensure(s + 1);
        const i = frameIndex(s);
        const a = frames[i];
        const t = s - a.s;
        if (t <= 0 || i + 1 >= frames.length) return { ...a, s };
        const b = frames[i + 1];
        const out = { s };
        for (const key of Object.keys(a)) {
            if (key !== 's') out[key] = a[key] + (b[key] - a[key]) * t;
        }
        return out;
    }

    function slopeAt(s) {
        return frameAt(s).slope; // interpolated, so the hilltop float glides instead of stepping
    }

    // 0..1: how sharply the track goes from climbing to dropping around s
    function crestLift(s) {
        return clamp(-(slopeAt(s + 3) - slopeAt(s - 3)) / 0.15, 0, 1);
    }

    function pruneBefore(s) {
        // Keep a few frames behind s for crestLift and interpolation
        const drop = Math.floor(s) - first - 3;
        if (drop > 0) {
            frames.splice(0, Math.min(drop, frames.length - 2));
            first = frames[0].s;
        }
    }

    return { ensure, frameAt, crestLift, pruneBefore, frameCount: () => frames.length };
}
