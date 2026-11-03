// Scoring: a little for every bit of track ridden, plus catches multiplied by the combo
export const DISTANCE_PER_POINT = 4;
export const STAR_POINTS = 10;
export const HEART_POINTS = 25;
export const NEAR_MISS_POINTS = 5;
export const COMBO_STEP = 3;      // catches in a row needed for each +1 to the multiplier
export const MAX_MULTIPLIER = 5;

export function createScoring() {
    let score = 0;
    let combo = 0;
    let bestMultiplier = 1;
    let distance = 0;

    const multiplier = () => Math.min(MAX_MULTIPLIER, 1 + Math.floor(combo / COMBO_STEP));

    return {
        get score() { return score; },
        get combo() { return combo; },
        get bestMultiplier() { return bestMultiplier; },
        multiplier,

        addDistance(units) {
            distance += units;
            const points = Math.floor(distance / DISTANCE_PER_POINT);
            score += points;
            distance -= points * DISTANCE_PER_POINT;
        },

        addCatch(points) {
            const before = multiplier();
            combo++;
            const mult = multiplier();
            score += points * mult;
            bestMultiplier = Math.max(bestMultiplier, mult);
            return { multiplierUp: mult > before };
        },

        bump() {
            combo = 0;
        },
    };
}
