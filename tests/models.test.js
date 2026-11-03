import { test } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-document.js';
import { SKINS, DEFAULT_SKIN, obstacleModel } from '../js/skins.js';
import { widthOf } from '../js/models.js';
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

test('space friends is the default skin', () => {
    assert.equal(DEFAULT_SKIN, 'space');
    assert.equal(SKINS.space.name, 'Space Friends');
});

test("space friends are really as wide as they say", () => {
    // Measure the widest point of each model's shape, so spacing and hits match what you see
    for (const [role, make] of Object.entries(SKINS.space.obstacles)) {
        for (let i = 0; i < 20; i++) {
            const { geo, radius } = make();
            const pos = geo.attributes.position;
            let widest = 0;
            for (let v = 0; v < pos.count; v++) widest = Math.max(widest, Math.hypot(pos.getX(v), pos.getZ(v)));
            assert.ok(widest <= radius * 1.05, `space ${role} is ${widest.toFixed(2)} wide but says ${radius.toFixed(2)}`);
        }
    }
});

test('space friends have things that move', () => {
    // UFO lights blink, satellites turn, rockets' flames flicker, aliens bob
    for (const role of ['floater', 'station', 'tall', 'buddy']) {
        const { object } = obstacleModel(role, 'space');
        const snapshot = () => {
            const parts = [];
            object.traverse(o => parts.push([o.position.toArray(), o.rotation.toArray(), o.material ? o.material.opacity : null]));
            return JSON.stringify(parts);
        };
        object.userData.update(0.2);
        const before = snapshot();
        object.userData.update(0.9);
        assert.notEqual(snapshot(), before, `space ${role} looks frozen`);
    }
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

test('what you see fits the placement size, in every skin', () => {
    for (const skinId of Object.keys(SKINS)) {
        for (const role of ROLES) {
            for (let i = 0; i < 20; i++) {
                const { object, radius } = obstacleModel(role, skinId);
                const model = object.userData.model;
                let mesh = null;
                model.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
                const seen = widthOf(mesh.geometry) * model.scale.x;
                assert.ok(seen <= KIND_RADIUS[role] + 1e-6, `${skinId} ${role} looks ${seen.toFixed(2)} wide, more than ${KIND_RADIUS[role]}`);
                assert.ok(Math.abs(seen - radius) < 1e-6, `${skinId} ${role} hitbox ${radius.toFixed(2)} should match what you see ${seen.toFixed(2)}`);
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
