import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, LEGACY_KEY } from '../js/storage.js';

// A stand-in for localStorage that tests can inspect
function memoryBacking(initial = {}) {
    const data = { ...initial };
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
    };
}

test('empty store starts clean', () => {
    const store = createStore(memoryBacking());
    assert.deepEqual(store.leaderboard('easy'), []);
    assert.deepEqual(store.leaderboard('hard'), []);
    assert.equal(store.best('easy'), 0);
    assert.equal(store.best('hard'), 0);
    assert.deepEqual(store.unlocked(), ['starter']);
    assert.equal(store.board(), 'starter');
    assert.equal(store.lastMode(), 'easy');
});

test('leaderboards and bests are kept per mode', () => {
    const store = createStore(memoryBacking());
    store.addScore('hard', 'Ava', 900);
    store.recordBest('hard', 900);
    assert.deepEqual(store.leaderboard('hard'), [{ name: 'Ava', score: 900 }]);
    assert.deepEqual(store.leaderboard('easy'), []);
    assert.equal(store.best('hard'), 900);
    assert.equal(store.best('easy'), 0);
});

test('top 5 only, highest first', () => {
    const store = createStore(memoryBacking());
    for (const score of [10, 70, 30, 50, 20, 60]) store.addScore('easy', `P${score}`, score);
    assert.deepEqual(store.leaderboard('easy').map(e => e.score), [70, 60, 50, 30, 20]);
});

test('qualifies needs a score above 0 and room or a higher score', () => {
    const store = createStore(memoryBacking());
    assert.equal(store.qualifies('easy', 0), false);
    assert.equal(store.qualifies('easy', 5), true);
    for (const score of [10, 20, 30, 40, 50]) store.addScore('easy', 'P', score);
    assert.equal(store.qualifies('easy', 10), false);
    assert.equal(store.qualifies('easy', 11), true);
});

test('recordBest only reports a new best', () => {
    const store = createStore(memoryBacking());
    assert.equal(store.recordBest('easy', 100), true);
    assert.equal(store.recordBest('easy', 80), false);
    assert.equal(store.recordBest('easy', 120), true);
    assert.equal(store.best('easy'), 120);
});

test('old leaderboard moves into Easy once', () => {
    const backing = memoryBacking({ [LEGACY_KEY]: JSON.stringify([{ name: 'Mia', score: 40 }, { name: 'Leo', score: 25 }]) });
    const store = createStore(backing);
    assert.deepEqual(store.leaderboard('easy'), [{ name: 'Mia', score: 40 }, { name: 'Leo', score: 25 }]);
    assert.deepEqual(store.leaderboard('hard'), []);
    assert.equal(store.best('easy'), 40);

    // Later scores are kept, and the old list is not copied in again
    store.addScore('easy', 'Zoe', 30);
    const again = createStore(backing);
    assert.deepEqual(again.leaderboard('easy').map(e => e.name), ['Mia', 'Zoe', 'Leo']);
});

test('migration never unlocks boards', () => {
    const store = createStore(memoryBacking({ [LEGACY_KEY]: JSON.stringify([{ name: 'Max', score: 50000 }]) }));
    assert.deepEqual(store.unlocked(), ['starter']);
});

test('unlocks are saved as soon as they happen', () => {
    const backing = memoryBacking();
    const store = createStore(backing);
    assert.deepEqual(store.unlock(['starter', 'candy']), ['candy']);
    assert.deepEqual(store.unlock(['candy']), []);
    assert.deepEqual(createStore(backing).unlocked(), ['starter', 'candy']);
});

test("a saved board that isn't unlocked falls back to the starter", () => {
    const store = createStore(memoryBacking({ sc3d_board: 'rainbow' }));
    assert.equal(store.board(), 'starter');
    assert.equal(store.setBoard('galaxy'), false);
    assert.equal(store.board(), 'starter');
    store.unlock(['galaxy']);
    assert.equal(store.setBoard('galaxy'), true);
    assert.equal(store.board(), 'galaxy');
});

test('last mode is remembered', () => {
    const backing = memoryBacking();
    createStore(backing).setLastMode('hard');
    assert.equal(createStore(backing).lastMode(), 'hard');
});

test('works without storage', () => {
    const store = createStore(null);
    store.addScore('easy', 'Ava', 10);
    store.unlock(['candy']);
    assert.deepEqual(store.leaderboard('easy'), [{ name: 'Ava', score: 10 }]);
    assert.deepEqual(store.unlocked(), ['starter', 'candy']);
});

test('survives storage that throws', () => {
    const broken = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
    };
    const store = createStore(broken);
    store.addScore('easy', 'Ava', 10);
    assert.equal(store.recordBest('easy', 10), true);
    assert.deepEqual(store.unlock(['candy']), ['candy']);
    assert.equal(store.setBoard('candy'), true);
    assert.deepEqual(store.leaderboard('easy'), [{ name: 'Ava', score: 10 }]);
});

test('ignores corrupted saved data', () => {
    const store = createStore(memoryBacking({ sc3d_lb_easy: 'not json', sc3d_unlocked: '{"oops":1}', sc3d_best_easy: 'abc' }));
    assert.deepEqual(store.leaderboard('easy'), []);
    assert.deepEqual(store.unlocked(), ['starter']);
    assert.equal(store.best('easy'), 0);
});
