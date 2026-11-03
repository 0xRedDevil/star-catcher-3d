// Did the board hit something, or only just miss it? Pure maths, no Three.js.

export const RIDER_HALF = 0.35;   // half the board's width
export const NEAR_MISS = 0.4;     // a gap this small still counts as a daring near miss

// Checks the whole stretch the board covered this frame, so a fast frame can't skip through
export function sweptCheck(item, prevS, s, riderX) {
    if (item.s <= prevS - 0.6 || item.s > s + 0.4) return null;
    const gap = Math.abs(item.x - riderX) - item.radius - RIDER_HALF;
    if (gap < 0) return 'hit';
    if (gap < NEAR_MISS) return 'near';
    return null;
}

// Rolling planets go back and forth across their range at a steady speed
export function planetX(range, t, speed = 2) {
    const width = range[1] - range[0];
    if (width <= 0) return range[0];
    const travel = (t * speed) % (2 * width);
    return range[0] + (travel <= width ? travel : 2 * width - travel);
}
