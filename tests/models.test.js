import { test } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-document.js';
import { obstacleModel } from '../js/models.js';
import { KIND_RADIUS, OBSTACLE_KINDS } from '../js/placement.js';

test('every obstacle model fits inside its placement radius', () => {
    for (const kind of [...OBSTACLE_KINDS, 'planet']) {
        for (let i = 0; i < 20; i++) {
            const { object, radius } = obstacleModel(kind);
            assert.ok(object.isObject3D, `${kind} gives an object`);
            assert.ok(radius > 0 && radius <= KIND_RADIUS[kind] + 1e-9, `${kind} radius ${radius} > ${KIND_RADIUS[kind]}`);
        }
    }
});

test('models are not too small to see', () => {
    for (const kind of [...OBSTACLE_KINDS, 'planet']) {
        const { radius } = obstacleModel(kind);
        assert.ok(radius >= KIND_RADIUS[kind] * 0.5, `${kind} radius ${radius} is tiny`);
    }
});
