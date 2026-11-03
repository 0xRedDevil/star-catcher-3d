// How the board moves along and across the track. Pure maths, no Three.js.

export const RIDER_LIMIT = 5.3;   // furthest the board can go from the centre before the wall
export const MAX_DT = 0.05;       // a long pause (hidden tab) never turns into one giant step

const STEER_EASE = 8;             // how quickly the board follows the steering target
const SPEED_EASE = 2;             // how quickly speed follows the slope
const SNAP = 1e-3;                // close enough to the target to stop easing

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Downhill (negative slope) is faster, uphill slower, never more than 20% either way
export function slopeSpeed(base, slope) {
    return clamp(base * (1 - slope * 0.8), base * 0.8, base * 1.2);
}

export function steer(x, targetX, dt) {
    const goal = clamp(targetX, -RIDER_LIMIT, RIDER_LIMIT);
    let next = x + (goal - x) * Math.min(1, dt * STEER_EASE);
    if (Math.abs(goal - next) < SNAP) next = goal;
    const wallTouch = Math.abs(targetX) > RIDER_LIMIT && Math.abs(next) === RIDER_LIMIT;
    return { x: next, wallTouch };
}

// Touching the magic wall: a little bounce only when the board first reaches it
export const WALL_BOUNCE_TIME = 0.25;
export const WALL_COOLDOWN = 0.4;
export const WALL_LEAN = 0.2;     // radians at the top of the bounce

export function wallBounceStep(state, wallTouch, dt) {
    const cooldown = Math.max(0, state.cooldown - dt);
    let bounce = Math.max(0, state.bounce - dt);
    const triggered = wallTouch && !state.touching && cooldown <= 0;
    if (triggered) bounce = WALL_BOUNCE_TIME;
    return {
        bounce,
        touching: wallTouch,
        cooldown: triggered ? WALL_COOLDOWN : cooldown,
        triggered,
        // Eases out and back in, so the board never snaps
        lean: WALL_LEAN * Math.sin(Math.PI * bounce / WALL_BOUNCE_TIME),
    };
}

export function advanceRide(state, base, slope, dt) {
    const step = Math.min(dt, MAX_DT);
    const speed = state.speed + (slopeSpeed(base, slope) - state.speed) * Math.min(1, step * SPEED_EASE);
    return { s: state.s + speed * step, speed };
}
