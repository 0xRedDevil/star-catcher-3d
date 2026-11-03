import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { useDistanceFog, fogAmount, FOG_NEAR, FOG_FAR } from '../js/fog.js';
import { createTrack } from '../js/track.js';
import { PLACE_AHEAD } from '../js/placement.js';

test('fog is measured by true distance, not just straight ahead', () => {
    useDistanceFog(THREE);
    assert.ok(THREE.ShaderChunk.fog_vertex.includes('length( mvPosition.xyz )'));
    assert.ok(!THREE.ShaderChunk.fog_vertex.includes('vFogDepth = - mvPosition.z'));
});

test('fog matches three.js linear fog', () => {
    assert.equal(fogAmount(FOG_NEAR), 0);
    assert.equal(fogAmount(FOG_FAR), 1);
    assert.ok(fogAmount((FOG_NEAR + FOG_FAR) / 2) > 0.4 && fogAmount((FOG_NEAR + FOG_FAR) / 2) < 0.6);
});

test('new track and obstacles appear deep in the fog', () => {
    // Things are placed PLACE_AHEAD along the track, which is always at least 120 units away
    // in a straight line (see track tests), so they must be almost fully hidden there
    for (const seed of [41, 42, 43]) {
        const track = createTrack({ seed, difficulty: () => 1 });
        track.ensure(10200);
        for (let s = 0; s <= 10000; s += 5) {
            const a = track.frameAt(s);
            const b = track.frameAt(s + PLACE_AHEAD);
            const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
            assert.ok(fogAmount(d) >= 0.95, `seed ${seed}: only ${(fogAmount(d) * 100).toFixed(0)}% hidden at s=${s}`);
        }
    }
});
