// Everything the game remembers between rides: top 5s and bests per mode, unlocked boards,
// the chosen board and the last mode. If the browser blocks saving, it still all works
// for the current visit. Pure, no Three.js.
import { BOARDS } from './boards.js';

const BOARD_IDS = BOARDS.map(b => b.id); // anything else in saved data is ignored

export const LEGACY_KEY = 'star_catcher_3d_leaderboard';   // the first version's top 5
const KEYS = {
    lb: (mode) => `sc3d_lb_${mode}`,
    best: (mode) => `sc3d_best_${mode}`,
    unlocked: 'sc3d_unlocked',
    board: 'sc3d_board',
    mode: 'sc3d_mode',
    celebrated: 'sc3d_celebrated',
};
const MODES = ['easy', 'hard'];
const TOP = 5;

function defaultBacking() {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch (e) {
        return null; // some browsers throw just for looking at localStorage
    }
}

function parseJson(raw) {
    try {
        return raw == null ? null : JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function asScores(value) {
    if (!Array.isArray(value)) return [];
    return value
        .filter(e => e && typeof e.name === 'string' && Number.isFinite(e.score))
        .map(e => ({ name: e.name, score: e.score }));
}

const topFive = (list) => list.slice().sort((a, b) => b.score - a.score).slice(0, TOP);

export function createStore(backing = defaultBacking()) {
    function read(key) {
        try {
            return backing ? backing.getItem(key) : null;
        } catch (e) {
            return null;
        }
    }
    function write(key, value) {
        try {
            if (backing) backing.setItem(key, value);
        } catch (e) {
            // Saving is blocked; keep going with what's in memory
        }
    }

    // Load once; from then on memory is the truth and every change is also saved
    const lb = {};
    const best = {};
    for (const mode of MODES) {
        lb[mode] = topFive(asScores(parseJson(read(KEYS.lb(mode)))));
        const saved = Number(read(KEYS.best(mode)));
        best[mode] = Number.isFinite(saved) && saved > 0 ? saved : 0;
    }

    // The first version's scores move into Easy, once. They never unlock boards.
    if (read(KEYS.lb('easy')) == null) {
        const legacy = topFive(asScores(parseJson(read(LEGACY_KEY))));
        if (legacy.length) {
            lb.easy = legacy;
            write(KEYS.lb('easy'), JSON.stringify(lb.easy));
            if (legacy[0].score > best.easy) {
                best.easy = legacy[0].score;
                write(KEYS.best('easy'), String(best.easy));
            }
        }
    }

    const savedUnlocks = parseJson(read(KEYS.unlocked));
    const unlockedIds = ['starter'];
    if (Array.isArray(savedUnlocks)) {
        for (const id of savedUnlocks) if (BOARD_IDS.includes(id) && !unlockedIds.includes(id)) unlockedIds.push(id);
    }
    const savedCelebrations = parseJson(read(KEYS.celebrated));
    const celebratedIds = Array.isArray(savedCelebrations) ? savedCelebrations.filter(id => typeof id === 'string') : [];
    let chosenBoard = read(KEYS.board);
    let mode = read(KEYS.mode) === 'hard' ? 'hard' : 'easy';

    return {
        leaderboard: (m) => lb[m].slice(),

        qualifies: (m, score) => score > 0 && (lb[m].length < TOP || score > lb[m][lb[m].length - 1].score),

        addScore(m, name, score) {
            lb[m] = topFive([...lb[m], { name, score }]);
            write(KEYS.lb(m), JSON.stringify(lb[m]));
        },

        best: (m) => best[m],

        recordBest(m, score) {
            if (score <= best[m]) return false;
            best[m] = score;
            write(KEYS.best(m), String(score));
            return true;
        },

        unlocked: () => unlockedIds.slice(),

        // Saved straight away, so an unlock survives closing the tab mid-ride
        unlock(ids) {
            const fresh = ids.filter(id => BOARD_IDS.includes(id) && !unlockedIds.includes(id));
            if (fresh.length) {
                unlockedIds.push(...fresh);
                write(KEYS.unlocked, JSON.stringify(unlockedIds));
            }
            return fresh;
        },

        board: () => (unlockedIds.includes(chosenBoard) ? chosenBoard : 'starter'),

        setBoard(id) {
            if (!unlockedIds.includes(id)) return false;
            chosenBoard = id;
            write(KEYS.board, id);
            return true;
        },

        // The first ride on a newly unlocked board gets a celebration, once
        celebrated: (id) => celebratedIds.includes(id),

        markCelebrated(id) {
            if (celebratedIds.includes(id)) return;
            celebratedIds.push(id);
            write(KEYS.celebrated, JSON.stringify(celebratedIds));
        },

        lastMode: () => mode,

        setLastMode(m) {
            mode = m === 'hard' ? 'hard' : 'easy';
            write(KEYS.mode, mode);
        },
    };
}
