// Lives: a bump costs one, then the board blinks and is safe for a moment
export const SAFE_TIME = 1.5;

export function createLives({ start = 3, max = 5 } = {}) {
    let lives = start;
    let safe = 0;

    return {
        get lives() { return lives; },
        get safe() { return safe; },
        isSafe: () => safe > 0,

        hit() {
            if (safe > 0 || lives <= 0) return { lost: false, gameOver: lives <= 0 };
            lives--;
            safe = SAFE_TIME;
            return { lost: true, gameOver: lives <= 0 };
        },

        heal() {
            if (lives >= max) return false;
            lives++;
            return true;
        },

        tick(dt) {
            safe = Math.max(0, safe - dt);
        },
    };
}
