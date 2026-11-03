import { test } from 'node:test';
import assert from 'node:assert/strict';

// sky.js draws glow textures on a canvas; a tiny stand-in is enough in Node
globalThis.document = {
    createElement: () => ({
        getContext: () => ({
            createRadialGradient: () => ({ addColorStop() {} }),
            fillRect() {},
        }),
    }),
};

const THREE = await import('three');
const { createSky } = await import('../js/sky.js');

test('glitter is never culled as the rider flies away from where it started', () => {
    const scene = new THREE.Scene();
    createSky(scene);
    // The glitter lives directly in the scene, in world coordinates
    const glitter = scene.children.filter(child => child.isPoints);
    assert.equal(glitter.length, 1);
    assert.equal(glitter[0].frustumCulled, false);
});
