import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTrack, TRACK_HALF_WIDTH } from '../js/track.js';
import { buildChunk, createTrackView, CHUNK_LENGTH, WALL_HEIGHT } from '../js/trackMesh.js';

const EPS = 1e-4; // float32 vertex buffers
const style = { colors: ['#ff4d6d', '#ffe66d', '#38bdf8'], wallColor: 0xff77ff };

function vertex(mesh, i) {
    const p = mesh.geometry.attributes.position;
    return [p.getX(i), p.getY(i), p.getZ(i)];
}

test('chunk and wall sizes', () => {
    assert.equal(CHUNK_LENGTH, 50);
    assert.equal(WALL_HEIGHT, 0.8);
});

test('ribbon has two vertices per unit', () => {
    const track = createTrack({ seed: 1, difficulty: () => 1 });
    const chunk = buildChunk(track, 0, 50, style);
    const ribbon = chunk.getObjectByName('ribbon');
    assert.equal(ribbon.geometry.attributes.position.count, 51 * 2);
});

test('ribbon edges sit 6 units from the centre', () => {
    const track = createTrack({ seed: 2, difficulty: () => 1 });
    const chunk = buildChunk(track, 100, 150, style);
    const ribbon = chunk.getObjectByName('ribbon');
    for (let i = 0; i <= 50; i++) {
        const f = track.frameAt(100 + i);
        for (const v of [vertex(ribbon, i * 2), vertex(ribbon, i * 2 + 1)]) {
            const d = Math.hypot(v[0] - f.x, v[1] - f.y, v[2] - f.z);
            assert.ok(Math.abs(d - TRACK_HALF_WIDTH) < EPS, `edge distance ${d} at s=${100 + i}`);
        }
    }
});

test('walls stand 0.8 above the track edge', () => {
    const track = createTrack({ seed: 3, difficulty: () => 1 });
    const chunk = buildChunk(track, 0, 50, style);
    for (const [name, side] of [['wall-left', -1], ['wall-right', 1]]) {
        const wall = chunk.getObjectByName(name);
        assert.ok(wall, `${name} exists`);
        for (let i = 0; i <= 50; i++) {
            const f = track.frameAt(i);
            const edge = [f.x + f.rx * side * TRACK_HALF_WIDTH, f.y + f.ry * side * TRACK_HALF_WIDTH, f.z + f.rz * side * TRACK_HALF_WIDTH];
            const bottom = vertex(wall, i * 2);
            const top = vertex(wall, i * 2 + 1);
            for (let k = 0; k < 3; k++) {
                assert.ok(Math.abs(bottom[k] - edge[k]) < EPS, `${name} bottom at s=${i}`);
                const up = [f.ux, f.uy, f.uz][k];
                assert.ok(Math.abs(top[k] - (edge[k] + up * WALL_HEIGHT)) < EPS, `${name} top at s=${i}`);
            }
        }
    }
});

test('view keeps only nearby chunks', () => {
    const track = createTrack({ seed: 4, difficulty: () => 1 });
    const scene = new THREE.Group();
    const view = createTrackView(track, scene, style);
    for (let s = 0; s <= 3000; s += 5) {
        view.update(s);
        assert.ok(scene.children.length <= Math.ceil(170 / 50) + 1, `${scene.children.length} chunks at s=${s}`);
    }
    // There is always track under and ahead of the rider
    assert.ok(scene.children.length >= 3);
    view.dispose();
    assert.equal(scene.children.length, 0);
});
