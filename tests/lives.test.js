import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLives, SAFE_TIME } from '../js/lives.js';

test('starts with 3 lives', () => {
    assert.equal(createLives().lives, 3);
    assert.equal(SAFE_TIME, 1.5);
});

test('a hit takes a life and gives 1.5 s of safety', () => {
    const lives = createLives();
    assert.deepEqual(lives.hit(), { lost: true, gameOver: false });
    assert.equal(lives.lives, 2);
    assert.equal(lives.isSafe(), true);
    lives.tick(1.4);
    assert.equal(lives.isSafe(), true);
    lives.tick(0.2);
    assert.equal(lives.isSafe(), false);
});

test('hits while safe are ignored', () => {
    const lives = createLives();
    lives.hit();
    assert.deepEqual(lives.hit(), { lost: false, gameOver: false });
    assert.equal(lives.lives, 2);
});

test('safety wears off', () => {
    const lives = createLives();
    lives.hit();
    lives.tick(1.6);
    lives.hit();
    assert.equal(lives.lives, 1);
});

test('game over at 0 lives', () => {
    const lives = createLives();
    lives.hit();
    lives.tick(2);
    lives.hit();
    lives.tick(2);
    assert.deepEqual(lives.hit(), { lost: true, gameOver: true });
    assert.equal(lives.lives, 0);
});

test('hearts heal up to 5 and no further', () => {
    const lives = createLives();
    assert.equal(lives.heal(), true);
    assert.equal(lives.heal(), true);
    assert.equal(lives.lives, 5);
    assert.equal(lives.heal(), false);
    assert.equal(lives.lives, 5);
});
