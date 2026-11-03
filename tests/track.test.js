import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createTrack, TRACK_HALF_WIDTH, MAX_YAW_RATE, MIN_SLOPE, MAX_SLOPE, MAX_BANK
} from '../js/track.js';

const EPS = 1e-6;
const len = (x, y, z) => Math.hypot(x, y, z);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const axes = (f) => ({ f: [f.fx, f.fy, f.fz], r: [f.rx, f.ry, f.rz], u: [f.ux, f.uy, f.uz] });

function walk(track, length, fn) {
    track.ensure(length + 1);
    for (let s = 0; s <= length; s++) fn(track.frameAt(s), s);
}

test('track half width is 6', () => {
    assert.equal(TRACK_HALF_WIDTH, 6);
});

test('frames are 1 unit apart', () => {
    const track = createTrack({ seed: 1 });
    track.ensure(2001);
    for (let s = 0; s < 2000; s++) {
        const a = track.frameAt(s);
        const b = track.frameAt(s + 1);
        assert.ok(Math.abs(len(b.x - a.x, b.y - a.y, b.z - a.z) - 1) < EPS, `gap at s=${s}`);
    }
});

test('frame axes are unit length and perpendicular', () => {
    const track = createTrack({ seed: 2, difficulty: () => 1 });
    walk(track, 3000, (frame, s) => {
        const { f, r, u } = axes(frame);
        for (const v of [f, r, u]) assert.ok(Math.abs(len(...v) - 1) < EPS, `length at s=${s}`);
        assert.ok(Math.abs(dot(f, r)) < EPS, `f.r at s=${s}`);
        assert.ok(Math.abs(dot(f, u)) < EPS, `f.u at s=${s}`);
        assert.ok(Math.abs(dot(r, u)) < EPS, `r.u at s=${s}`);
    });
});

test('turn rate never tighter than radius 25', () => {
    assert.equal(MAX_YAW_RATE, 0.04);
    const track = createTrack({ seed: 3, difficulty: () => 1 });
    walk(track, 20000, (frame, s) => {
        assert.ok(Math.abs(frame.yawRate) <= MAX_YAW_RATE + EPS, `yawRate ${frame.yawRate} at s=${s}`);
    });
});

test('slope stays within limits', () => {
    const track = createTrack({ seed: 4, difficulty: () => 1 });
    walk(track, 20000, (frame, s) => {
        assert.ok(frame.slope >= MIN_SLOPE - EPS && frame.slope <= MAX_SLOPE + EPS, `slope ${frame.slope} at s=${s}`);
    });
});

test('bank is capped and leans into the turn', () => {
    assert.ok(Math.abs(MAX_BANK - 0.436) < 0.001);
    const track = createTrack({ seed: 5, difficulty: () => 1 });
    let leaningTurns = 0;
    walk(track, 20000, (frame, s) => {
        assert.ok(Math.abs(frame.bank) <= MAX_BANK + EPS, `bank ${frame.bank} at s=${s}`);
        if (Math.abs(frame.yawRate) > 0.005) {
            assert.equal(Math.sign(frame.bank), Math.sign(frame.yawRate), `bank direction at s=${s}`);
            leaningTurns++;
        }
    });
    assert.ok(leaningTurns > 1000, 'the track should actually turn');
});

test('turn rate and slope change smoothly', () => {
    const track = createTrack({ seed: 6, difficulty: () => 1 });
    track.ensure(20001);
    for (let s = 0; s < 20000; s++) {
        const a = track.frameAt(s);
        const b = track.frameAt(s + 1);
        assert.ok(Math.abs(b.yawRate - a.yawRate) <= 0.004 + EPS, `yawRate jump at s=${s}`);
        assert.ok(Math.abs(b.slope - a.slope) <= 0.02 + EPS, `slope jump at s=${s}`);
    }
});

test('height stays within a band', () => {
    for (const seed of [11, 22, 33]) {
        const track = createTrack({ seed, difficulty: () => 1 });
        walk(track, 20000, (frame, s) => {
            assert.ok(Math.abs(frame.y) <= 40, `seed ${seed}: height ${frame.y} at s=${s}`);
        });
    }
});

test('same seed gives the same track', () => {
    const a = createTrack({ seed: 7 });
    const b = createTrack({ seed: 7 });
    a.ensure(1300);
    b.ensure(1300);
    assert.deepEqual(a.frameAt(1234), b.frameAt(1234));
});

test('difficulty widens the allowed turns', () => {
    const maxTurn = (difficulty) => {
        const track = createTrack({ seed: 8, difficulty: () => difficulty });
        let max = 0;
        walk(track, 5000, (frame) => { max = Math.max(max, Math.abs(frame.yawRate)); });
        return max;
    };
    assert.ok(maxTurn(1) > maxTurn(0));
});

test('frameAt interpolates between whole units', () => {
    const track = createTrack({ seed: 9 });
    track.ensure(20);
    const a = track.frameAt(10);
    const b = track.frameAt(11);
    const mid = track.frameAt(10.5);
    assert.ok(Math.abs(mid.x - (a.x + b.x) / 2) < EPS);
    assert.ok(Math.abs(mid.z - (a.z + b.z) / 2) < EPS);
    assert.equal(mid.s, 10.5);
});

test('crestLift is high where a climb turns into a drop', () => {
    const track = createTrack({
        seed: 10,
        sections: [{ length: 60, yawRate: 0, slope: 0.15 }, { length: 60, yawRate: 0, slope: -0.2 }, { length: 200, yawRate: 0, slope: 0 }]
    });
    track.ensure(300);
    let best = 0;
    for (let s = 55; s <= 75; s++) best = Math.max(best, track.crestLift(s));
    assert.ok(best > 0.5, `crestLift near the top was ${best}`);
    assert.equal(track.crestLift(20), 0);
});

test('crestLift changes smoothly between whole units', () => {
    const track = createTrack({
        seed: 13,
        sections: [{ length: 60, yawRate: 0, slope: 0.15 }, { length: 60, yawRate: 0, slope: -0.2 }, { length: 200, yawRate: 0, slope: 0 }]
    });
    track.ensure(300);
    for (let s = 40; s < 100; s += 0.1) {
        const step = Math.abs(track.crestLift(s + 0.1) - track.crestLift(s));
        assert.ok(step < 0.02, `crestLift jumped by ${step} at s=${s.toFixed(1)}`);
    }
});

test('pruneBefore keeps frame count bounded over 20000 units', () => {
    const track = createTrack({ seed: 12, difficulty: () => 1 });
    for (let s = 0; s <= 20000; s += 10) {
        track.ensure(s + 150);
        track.pruneBefore(s - 20);
        assert.ok(track.frameCount() <= 200, `${track.frameCount()} frames kept at s=${s}`);
    }
    // Frames ahead are still usable after pruning
    assert.ok(Number.isFinite(track.frameAt(20100).x));
});
