import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slopeSpeed, steer, advanceRide, wallBounceStep, RIDER_LIMIT, MAX_DT } from '../js/riding.js';

const WALL_START = { bounce: 0, touching: false, cooldown: 0 };

test('wall bounce triggers once while the wall is held', () => {
    let state = WALL_START;
    let triggers = 0;
    for (let i = 0; i < 300; i++) {
        state = wallBounceStep(state, true, 1 / 60);
        if (state.triggered) triggers++;
    }
    assert.equal(triggers, 1);
});

test('wall bounce triggers again after leaving the wall and coming back', () => {
    let state = WALL_START;
    let triggers = 0;
    const run = (touch, frames) => {
        for (let i = 0; i < frames; i++) {
            state = wallBounceStep(state, touch, 1 / 60);
            if (state.triggered) triggers++;
        }
    };
    run(true, 30);
    run(false, 60);
    run(true, 30);
    assert.equal(triggers, 2);
});

test('wall bounce lean eases in and out with no big jumps', () => {
    let state = WALL_START;
    let prev = 0;
    let peak = 0;
    for (let i = 0; i < 60; i++) {
        state = wallBounceStep(state, true, 1 / 60);
        assert.ok(Math.abs(state.lean - prev) < 0.05, `lean jumped by ${Math.abs(state.lean - prev)} at frame ${i}`);
        peak = Math.max(peak, state.lean);
        prev = state.lean;
    }
    assert.ok(peak > 0.15, `the bounce should be visible (peak ${peak})`);
    assert.equal(state.lean, 0);
});

test('rider limit and max step', () => {
    assert.equal(RIDER_LIMIT, 5.3);
    assert.equal(MAX_DT, 0.05);
});

test('downhill is faster and uphill slower, within 20%', () => {
    assert.equal(slopeSpeed(10, 0), 10);
    assert.ok(Math.abs(slopeSpeed(10, -0.25) - 12) < 1e-9);
    const uphill = slopeSpeed(10, 0.2);
    assert.ok(uphill >= 8 && uphill < 10, `uphill speed ${uphill}`);
});

test('steering clamps at the wall and reports the touch', () => {
    let state = { x: 0, wallTouch: false };
    for (let i = 0; i < 200; i++) state = steer(state.x, 9, 1 / 60);
    assert.equal(state.x, 5.3);
    assert.equal(state.wallTouch, true);

    for (let i = 0; i < 200; i++) state = steer(state.x, -9, 1 / 60);
    assert.equal(state.x, -5.3);
    assert.equal(state.wallTouch, true);
});

test('steering inside the track does not touch the wall', () => {
    let state = { x: 0, wallTouch: false };
    for (let i = 0; i < 200; i++) state = steer(state.x, 3, 1 / 60);
    assert.equal(state.x, 3);
    assert.equal(state.wallTouch, false);
});

test('holding into the wall stays at the limit without oscillating', () => {
    let state = { x: 0, wallTouch: false };
    let reached = false;
    for (let i = 0; i < 200; i++) {
        state = steer(state.x, 9, 1 / 60);
        if (state.x === 5.3) reached = true;
        if (reached) assert.equal(state.x, 5.3, `moved off the wall at step ${i}`);
    }
    assert.ok(reached);
});

test('advanceRide moves along the track at the eased speed', () => {
    const next = advanceRide({ s: 100, speed: 10 }, 10, 0, 0.02);
    assert.ok(Math.abs(next.s - 100.2) < 1e-9);
    assert.equal(next.speed, 10);
});

test('advanceRide speeds up going downhill', () => {
    let state = { s: 0, speed: 10 };
    for (let i = 0; i < 300; i++) state = advanceRide(state, 10, -0.25, 1 / 60);
    assert.ok(state.speed > 11.5, `speed ${state.speed}`);
});

test('advanceRide clamps a huge dt', () => {
    const next = advanceRide({ s: 0, speed: 20 }, 20, 0, 5);
    assert.ok(next.s <= 20 * 0.05 + 1e-9, `moved ${next.s}`);
});
