import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweptCheck, planetX, RIDER_HALF, NEAR_MISS } from '../js/collision.js';
import { createTrack } from '../js/track.js';
import { createPlacer, EASY } from '../js/placement.js';

const rock = { s: 10, x: 0, radius: 0.6 };

test('rider and near-miss sizes', () => {
    assert.equal(RIDER_HALF, 0.35);
    assert.equal(NEAR_MISS, 0.4);
});

test('hit when the board passes right through', () => {
    assert.equal(sweptCheck(rock, 9.8, 10.1, 0.5), 'hit');
});

test('near miss just outside reach', () => {
    assert.equal(sweptCheck(rock, 9.8, 10.1, 0.6 + 0.35 + 0.2), 'near');
});

test('nothing when far away sideways', () => {
    assert.equal(sweptCheck(rock, 9.8, 10.1, 3), null);
});

test('nothing before or after the board reaches it', () => {
    assert.equal(sweptCheck(rock, 5, 6, 0), null);
    assert.equal(sweptCheck(rock, 11, 12, 0), null);
});

test('a fast frame cannot skip over an obstacle', () => {
    // One 0.05 s frame at 40 units/s jumps two whole units
    assert.equal(sweptCheck(rock, 9, 11, 0), 'hit');
});

test('planets roll within their range', () => {
    const range = [-5, -2];
    let reachedLow = false;
    let reachedHigh = false;
    for (let t = 0; t <= 60; t += 0.01) {
        const x = planetX(range, t);
        assert.ok(x >= range[0] - 1e-9 && x <= range[1] + 1e-9, `x ${x} at t=${t}`);
        if (x < range[0] + 0.05) reachedLow = true;
        if (x > range[1] - 0.05) reachedHigh = true;
    }
    assert.ok(reachedLow && reachedHigh, 'planet should roll from end to end');
});

test('drift speed can be set', () => {
    // At speed 1 it takes twice as long to cross the range as at speed 2
    assert.ok(Math.abs(planetX([0, 2], 1, 2) - 2) < 1e-9);
    assert.ok(Math.abs(planetX([0, 2], 1, 1) - 1) < 1e-9);
});

test('a rider who never steers gets hit', () => {
    const track = createTrack({ seed: 31, difficulty: () => 1 });
    const placer = createPlacer({ seed: 31, track, mode: EASY });
    const items = placer.fill(600, 0).filter(p => p.type === 'obstacle' || p.type === 'planet');
    let hits = 0;
    for (let s = 0.2; s <= 600; s += 0.2) {
        for (const item of items) {
            const x = item.range ? planetX(item.range, s / 11) : item.x;
            if (sweptCheck({ ...item, x }, s - 0.2, s, 0) === 'hit') hits++;
        }
    }
    assert.ok(hits > 0, 'standing still in the middle should not be safe');
});
