import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScoring, NEAR_MISS_POINTS } from '../js/scoring.js';

test('near miss counts as a catch worth 5 times the combo', () => {
    assert.equal(NEAR_MISS_POINTS, 5);
    const scoring = createScoring();
    scoring.addCatch(NEAR_MISS_POINTS);
    assert.equal(scoring.score, 5);
    assert.equal(scoring.combo, 1);
});

test('1 point per 4 units of distance', () => {
    const scoring = createScoring();
    scoring.addDistance(10);
    scoring.addDistance(6);
    assert.equal(scoring.score, 4);
});

test('combo rises every 3 catches, max x5', () => {
    const scoring = createScoring();
    for (let i = 0; i < 3; i++) scoring.addCatch(10);
    assert.equal(scoring.multiplier(), 2);
    for (let i = 0; i < 27; i++) scoring.addCatch(10);
    assert.equal(scoring.multiplier(), 5);
    assert.equal(scoring.bestMultiplier, 5);
});

test('addCatch reports when the multiplier goes up', () => {
    const scoring = createScoring();
    assert.equal(scoring.addCatch(10).multiplierUp, false);
    assert.equal(scoring.addCatch(10).multiplierUp, false);
    assert.equal(scoring.addCatch(10).multiplierUp, true);
});

test('a bump resets the combo', () => {
    const scoring = createScoring();
    for (let i = 0; i < 6; i++) scoring.addCatch(10);
    const before = scoring.score;
    scoring.bump();
    assert.equal(scoring.multiplier(), 1);
    assert.equal(scoring.combo, 0);
    assert.equal(scoring.score, before);
});

test('a star scores 10 times the combo', () => {
    const scoring = createScoring();
    scoring.addCatch(10);
    scoring.addCatch(10);
    assert.equal(scoring.score, 20);
    scoring.addCatch(10);
    assert.equal(scoring.score, 40);
});
