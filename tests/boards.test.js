import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARDS, unlocksFor } from '../js/boards.js';

test('boards and their unlock scores', () => {
    assert.deepEqual(BOARDS.map(b => [b.id, b.unlockScore]), [['starter', 0], ['candy', 2000], ['galaxy', 5000], ['rainbow', 10000]]);
});

test('unlock scores', () => {
    assert.deepEqual(unlocksFor(0), ['starter']);
    assert.deepEqual(unlocksFor(1999), ['starter']);
    assert.deepEqual(unlocksFor(2000), ['starter', 'candy']);
    assert.deepEqual(unlocksFor(9999), ['starter', 'candy', 'galaxy']);
    assert.deepEqual(unlocksFor(10000), ['starter', 'candy', 'galaxy', 'rainbow']);
});
