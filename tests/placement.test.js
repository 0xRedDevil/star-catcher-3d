import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrack, TRACK_HALF_WIDTH } from '../js/track.js';
import { RIDER_LIMIT } from '../js/riding.js';
import { createPlacer, EASY, FREE_RIDE, KIND_RADIUS, OBSTACLE_KINDS } from '../js/placement.js';

const EPS = 1e-9;

// Ride to 6000 the way the game does: fill a little ahead, with time passing at about 11 units/s
function ride(seed = 1, mode = EASY, elapsedFor = (s) => s / 11) {
    const track = createTrack({ seed, difficulty: () => 1 });
    const placer = createPlacer({ seed, track, mode });
    const all = [];
    for (let s = 0; s <= 6000; s += 50) all.push(...placer.fill(s, elapsedFor(s)));
    return { track, all };
}

const obstacles = (all) => all.filter(p => p.type === 'obstacle');
const rowCount = (all) => Math.max(...all.map(p => p.row)) + 1;

test('kinds and radii', () => {
    assert.deepEqual(OBSTACLE_KINDS, ['crystalPine', 'toadstool', 'moonRock', 'snowman', 'fairyHouse', 'stormCloud']);
    for (const kind of [...OBSTACLE_KINDS, 'planet']) assert.ok(KIND_RADIUS[kind] > 0, kind);
});

test('nothing before s = 40', () => {
    const { all } = ride(2);
    assert.ok(all.length > 0);
    for (const p of all) assert.ok(p.s >= 40, `${p.type} at s=${p.s}`);
});

test('every row leaves the safe lane clear', () => {
    for (const seed of [3, 4, 5]) {
        const { all } = ride(seed);
        for (const p of obstacles(all)) {
            assert.ok(Math.abs(p.x - p.safeX) >= p.radius + 1.3 - EPS, `seed ${seed}: ${p.kind} too close to the safe lane at s=${p.s}`);
        }
    }
});

test('safe lane steps at most 1.2 per row', () => {
    const { all } = ride(6);
    const lanes = new Map();
    for (const p of all) lanes.set(p.row, p.safeX);
    const rows = [...lanes.keys()].sort((a, b) => a - b);
    for (let i = 1; i < rows.length; i++) {
        if (rows[i] !== rows[i - 1] + 1) continue;
        assert.ok(Math.abs(lanes.get(rows[i]) - lanes.get(rows[i - 1])) <= 1.2 + EPS, `row ${rows[i]}`);
    }
});

test('obstacles in a row do not overlap', () => {
    const { all } = ride(7);
    const byRow = new Map();
    for (const p of obstacles(all)) byRow.set(p.row, [...(byRow.get(p.row) || []), p]);
    for (const [row, list] of byRow) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const gap = Math.abs(list[i].x - list[j].x);
                assert.ok(gap >= list[i].radius + list[j].radius + 0.3 - EPS, `row ${row} overlap`);
            }
        }
    }
});

test('everything stays on the track', () => {
    const { all } = ride(8);
    for (const p of all) {
        if (p.type === 'obstacle') {
            assert.ok(Math.abs(p.x) + p.radius <= TRACK_HALF_WIDTH - 0.1 + EPS, `${p.kind} off the edge at s=${p.s}`);
        } else if (p.type === 'planet') {
            assert.ok(p.range[0] - p.radius >= -(TRACK_HALF_WIDTH - 0.1) - EPS && p.range[1] + p.radius <= TRACK_HALF_WIDTH - 0.1 + EPS);
        } else {
            assert.ok(Math.abs(p.x) <= RIDER_LIMIT + EPS, `${p.type} out of reach at s=${p.s}`);
        }
    }
});

test('no obstacles just after a crest', () => {
    const { track, all } = ride(9);
    for (const p of [...obstacles(all), ...all.filter(q => q.type === 'planet')]) {
        for (let u = Math.floor(p.s - 12); u <= Math.floor(p.s); u++) {
            assert.ok(track.crestLift(u) <= 0.3, `${p.kind} at s=${p.s} is hidden by the crest at ${u}`);
        }
    }
});

test('breathers leave 100 obstacle-free units after every 450', () => {
    const { all } = ride(10);
    const blocking = all.filter(p => p.type === 'obstacle' || p.type === 'planet');
    assert.ok(blocking.length > 100);
    for (const p of blocking) assert.ok(p.s % 550 < 450, `obstacle in a breather at s=${p.s}`);
});

test('stars on about a quarter of rows, in the safe lane', () => {
    const { all } = ride(11);
    const stars = all.filter(p => p.type === 'star');
    for (const st of stars) assert.equal(st.x, st.safeX);
    const share = new Set(stars.map(st => st.row)).size / rowCount(all);
    assert.ok(share >= 0.18 && share <= 0.35, `stars on ${(share * 100).toFixed(0)}% of rows`);
});

test('hearts only when the mode allows', () => {
    const none = ride(12, { ...EASY, hearts: false }).all.filter(p => p.type === 'heart');
    assert.equal(none.length, 0);
    const { all } = ride(12);
    const share = all.filter(p => p.type === 'heart').length / rowCount(all);
    assert.ok(share >= 0.01 && share <= 0.06, `hearts on ${(share * 100).toFixed(1)}% of rows`);
});

test('planets stay on one side of the safe lane', () => {
    const { all } = ride(13);
    const planets = all.filter(p => p.type === 'planet');
    assert.ok(planets.length > 5, 'planets should appear');
    for (const p of planets) {
        const clear = p.radius + 1.3;
        const left = p.range[1] <= p.safeX - clear + EPS;
        const right = p.range[0] >= p.safeX + clear - EPS;
        assert.ok(left || right, `planet at s=${p.s} crosses the safe lane`);
        assert.ok(p.s >= 280, `planet too early at s=${p.s}`);
    }
});

test('storm clouds drift on their own side of the safe lane', () => {
    for (const seed of [17, 18]) {
        const clouds = ride(seed).all.filter(p => p.kind === 'stormCloud');
        assert.ok(clouds.length > 20, 'storm clouds should appear');
        for (const p of clouds) {
            const clear = p.radius + 1.3;
            assert.ok(Array.isArray(p.range), `cloud at s=${p.s} should drift`);
            assert.ok(p.range[0] <= p.x && p.x <= p.range[1], 'drift range includes where it starts');
            assert.ok(p.range[1] - p.range[0] >= 1, `cloud at s=${p.s} barely moves`);
            const left = p.range[1] <= p.safeX - clear + EPS;
            const right = p.range[0] >= p.safeX + clear - EPS;
            assert.ok(left || right, `cloud at s=${p.s} would drift into the safe lane`);
            assert.ok(p.range[0] - p.radius >= -(TRACK_HALF_WIDTH - 0.1) - EPS && p.range[1] + p.radius <= TRACK_HALF_WIDTH - 0.1 + EPS);
        }
    }
});

test('drifting clouds never pass through their neighbours', () => {
    const { all } = ride(19, EASY, () => 120); // busy rows
    const byRow = new Map();
    for (const p of obstacles(all)) byRow.set(p.row, [...(byRow.get(p.row) || []), p]);
    let checked = 0;
    for (const list of byRow.values()) {
        for (const cloud of list.filter(p => p.range)) {
            for (const other of list.filter(p => p !== cloud)) {
                const [lo, hi] = cloud.range;
                const gap = other.x < lo ? lo - other.x : other.x > hi ? other.x - hi : 0;
                assert.ok(gap >= cloud.radius + other.radius + 0.3 - EPS, `cloud drifts into a ${other.kind} at s=${cloud.s}`);
                checked++;
            }
        }
    }
    assert.ok(checked > 20, 'should have busy rows with clouds to check');
});

test('rows get closer and fuller the longer you ride', () => {
    const stats = (elapsed) => {
        const { all } = ride(14, EASY, () => elapsed);
        const rowS = new Map();
        const rowObstacles = new Map();
        for (const p of all) {
            if (!rowS.has(p.row) || p.type !== 'planet') rowS.set(p.row, Math.min(rowS.get(p.row) ?? Infinity, p.s));
            if (p.type === 'obstacle') rowObstacles.set(p.row, (rowObstacles.get(p.row) || 0) + 1);
        }
        const counts = [...rowObstacles.values()];
        return { gap: 6000 / rowCount(all), count: counts.reduce((a, b) => a + b, 0) / counts.length };
    };
    const early = stats(0);
    const late = stats(120);
    assert.ok(late.gap < early.gap, `gap ${early.gap} -> ${late.gap}`);
    assert.ok(late.count > early.count, `count ${early.count} -> ${late.count}`);
});

test('same seed gives the same placements', () => {
    assert.deepEqual(ride(15).all, ride(15).all);
});

test('free ride places nothing', () => {
    const track = createTrack({ seed: 16 });
    const placer = createPlacer({ seed: 16, track, mode: FREE_RIDE });
    assert.deepEqual(placer.fill(6000, 500), []);
});
