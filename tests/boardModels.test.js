import { test } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-document.js';
import { createBoardModel } from '../js/boardModels.js';
import { BOARDS } from '../js/boards.js';

// Everything that could visibly move: transforms, opacity and texture scrolling
function snapshot(group) {
    const parts = [];
    group.traverse(obj => {
        parts.push([obj.position.toArray(), obj.rotation.toArray(), obj.scale.toArray()]);
        const mat = obj.material;
        if (mat) parts.push([mat.opacity, mat.map ? mat.map.offset.toArray() : null]);
    });
    return JSON.stringify(parts);
}

test('every board builds and animates', () => {
    for (const { id } of BOARDS) {
        const board = createBoardModel(id);
        assert.ok(board.group.isObject3D, id);
        assert.ok(board.trailColors.length >= 1, `${id} trail colours`);
        for (let i = 0; i < 120; i++) board.update(1 / 60, i / 60);
    }
});

test('each tier sparkles more than the last', () => {
    const rates = BOARDS.map(b => createBoardModel(b.id).trailRate);
    for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1], `rates ${rates}`);
});

test('the super rainbow board has orbiting stars', () => {
    const board = createBoardModel('rainbow');
    const stars = [];
    board.group.traverse(obj => { if (obj.name === 'orbit-star') stars.push(obj); });
    assert.equal(stars.length, 3);
    const before = stars.map(s => s.position.clone());
    board.update(0.1, 0.5);
    stars.forEach((s, i) => assert.ok(s.position.distanceTo(before[i]) > 0.01, `star ${i} should move`));
});

test('unlocked boards have something moving', () => {
    for (const id of ['candy', 'galaxy', 'rainbow']) {
        const board = createBoardModel(id);
        board.update(1 / 60, 0);
        const before = snapshot(board.group);
        board.update(0.4, 0.7);
        assert.notEqual(snapshot(board.group), before, `${id} looks frozen`);
    }
});
