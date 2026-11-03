import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, speedAt } from '../js/modes.js';
import { createTrack } from '../js/track.js';
import { createPlacer, HARD } from '../js/placement.js';

function ride(mode, seed = 51) {
    const track = createTrack({ seed, difficulty: () => 1 });
    const placer = createPlacer({ seed, track, mode: mode.placement });
    const all = [];
    for (let s = 0; s <= 6000; s += 50) all.push(...placer.fill(s, s / mode.speed.start));
    return all;
}

test('modes', () => {
    assert.equal(MODES.easy.lives, 3);
    assert.equal(MODES.hard.lives, 3);
    assert.equal(MODES.hard.placement, HARD);
    assert.equal(HARD.hearts, false);
});

test('hard places no hearts', () => {
    for (const seed of [51, 52, 53]) {
        assert.equal(ride(MODES.hard, seed).filter(p => p.type === 'heart').length, 0);
    }
});

test('easy keeps its hearts', () => {
    assert.ok(ride(MODES.easy).filter(p => p.type === 'heart').length > 0);
});

test('hard is faster and busier than easy', () => {
    for (const t of [0, 60, 600]) assert.ok(speedAt(MODES.hard, t) > speedAt(MODES.easy, t), `speed at ${t}s`);

    const busy = (all) => {
        const obstacles = all.filter(p => p.type === 'obstacle');
        const rows = new Set(obstacles.map(p => p.row)).size;
        return { perRow: obstacles.length / rows, rows: Math.max(...all.map(p => p.row)) + 1 };
    };
    const easy = busy(ride(MODES.easy));
    const hard = busy(ride(MODES.hard));
    assert.ok(hard.perRow > easy.perRow, `obstacles per row ${easy.perRow} vs ${hard.perRow}`);
    assert.ok(hard.rows > easy.rows, `rows ${easy.rows} vs ${hard.rows}`);
});

test('speed grows then stops at the cap', () => {
    assert.equal(speedAt(MODES.easy, 0), 11);
    assert.equal(speedAt(MODES.hard, 0), 13);
    assert.ok(speedAt(MODES.easy, 30) > 11);
    assert.equal(speedAt(MODES.easy, 1000), 22);
    assert.equal(speedAt(MODES.hard, 1000), 28);
});
