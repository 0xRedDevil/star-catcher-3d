// Easy and Hard: lives, speed and how busy the track gets. Pure, no Three.js.
import { EASY, HARD } from './placement.js';

export const MODES = {
    easy: {
        id: 'easy',
        label: 'Easy',
        lives: 3,
        maxLives: 5,
        speed: { start: 11, growth: 0.15, max: 22 },
        placement: EASY,
    },
    hard: {
        id: 'hard',
        label: 'Hard',
        lives: 3,
        maxLives: 3,
        speed: { start: 13, growth: 0.25, max: 28 },
        placement: HARD,
    },
};

export function speedAt(mode, elapsed) {
    return Math.min(mode.speed.max, mode.speed.start + elapsed * mode.speed.growth);
}
