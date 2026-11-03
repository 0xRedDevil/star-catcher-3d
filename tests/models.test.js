import { test } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-document.js';
import { SKINS, obstacleModel } from '../js/skins.js';
import { KIND_RADIUS, OBSTACLE_KINDS } from '../js/placement.js';

const ROLES = [...OBSTACLE_KINDS, 'planet'];

test('every skin has a model for every obstacle role', () => {
    assert.ok(Object.keys(SKINS).length >= 1);
    for (const [id, skin] of Object.entries(SKINS)) {
        assert.equal(skin.id, id);
        assert.ok(skin.name, `${id} has a name`);
        for (const role of ROLES) assert.equal(typeof skin.obstacles[role], 'function', `${id} is missing ${role}`);
    }
});

test('fairy forest is kept as a skin', () => {
    assert.ok(SKINS.forest);
});

test('every obstacle model fits inside its placement radius', () => {
    for (const skinId of Object.keys(SKINS)) {
        for (const role of ROLES) {
            for (let i = 0; i < 20; i++) {
                const { object, radius } = obstacleModel(role, skinId);
                assert.ok(object.isObject3D, `${skinId} ${role} gives an object`);
                assert.ok(radius > 0 && radius <= KIND_RADIUS[role] + 1e-9, `${skinId} ${role} radius ${radius} > ${KIND_RADIUS[role]}`);
            }
        }
    }
});

test('models are not too small to see', () => {
    for (const skinId of Object.keys(SKINS)) {
        for (const role of ROLES) {
            const { radius } = obstacleModel(role, skinId);
            assert.ok(radius >= KIND_RADIUS[role] * 0.5, `${skinId} ${role} radius ${radius} is tiny`);
        }
    }
});

test('every obstacle can animate', () => {
    for (const skinId of Object.keys(SKINS)) {
        for (const role of ROLES) {
            const { object } = obstacleModel(role, skinId);
            assert.equal(typeof object.userData.update, 'function', `${skinId} ${role}`);
            for (let t = 0; t < 2; t += 0.1) object.userData.update(t);
        }
    }
});
