import { test } from 'node:test';
import assert from 'node:assert/strict';
import './support/fake-document.js';
import * as THREE from 'three';
import { createSky } from '../js/sky.js';

test('glitter is never culled as the rider flies away from where it started', () => {
    const scene = new THREE.Scene();
    createSky(scene);
    // The glitter lives directly in the scene, in world coordinates
    const glitter = scene.children.filter(child => child.isPoints);
    assert.equal(glitter.length, 1);
    assert.equal(glitter[0].frustumCulled, false);
});

test('sky has planets', () => {
    const scene = new THREE.Scene();
    createSky(scene);
    const planets = [];
    scene.traverse(obj => { if (obj.name === 'planet') planets.push(obj); });
    assert.ok(planets.length >= 3, `${planets.length} planets`);
});

test('nebulae drift to the zone colours', () => {
    const scene = new THREE.Scene();
    const sky = createSky(scene);
    sky.setNebula([0xff0000, 0x00ff00]);
    for (let i = 0; i < 600; i++) sky.update(1 / 60, new THREE.Vector3());
    const colours = new Set();
    scene.traverse(obj => { if (obj.name === 'nebula') colours.add(obj.material.color.getHex()); });
    assert.ok(colours.size > 0, 'nebulae exist');
    for (const c of colours) assert.ok([0xff0000, 0x00ff00].includes(c), `nebula colour ${c.toString(16)}`);
});

test('sky can update without errors', () => {
    const scene = new THREE.Scene();
    const sky = createSky(scene);
    for (let i = 0; i < 600; i++) sky.update(1 / 60, new THREE.Vector3(i, 0, -i));
});
