// Space around the track: starfield, moon, drifting clouds and falling glitter.
// The far-away parts follow the rider so space always surrounds the track.
import * as THREE from 'three';
import { glowTex, makeGlow, makeSkyCloud, rand } from './models.js';

const GLITTER_COUNT = 500;
const GLITTER_RANGE = 30;   // glitter is kept within this box around the rider

function makeStarfield(count, radius) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        // All around, including below, since the track floats in space
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.cos(phi);
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0xffffff, size: 1.8, map: glowTex, transparent: true,
        depthWrite: false, fog: false
    }));
}

export function createSky(scene) {
    const far = new THREE.Group();
    scene.add(far);
    far.add(makeStarfield(1800, 250));

    const moon = new THREE.Mesh(
        new THREE.IcosahedronGeometry(9, 2),
        new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
    );
    moon.position.set(-60, 55, -230);
    far.add(moon);
    const moonGlow = makeGlow(0xffe9a8, 50, 0.5);
    moonGlow.material.fog = false;
    moonGlow.position.copy(moon.position);
    far.add(moonGlow);

    const skyCloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, fog: false });
    const clouds = [];
    for (let i = 0; i < 14; i++) {
        const cloud = new THREE.Mesh(makeSkyCloud(), skyCloudMat);
        const a = rand(0, Math.PI * 2);
        const d = rand(90, 190);
        cloud.position.set(Math.cos(a) * d, rand(-40, 45), Math.sin(a) * d);
        cloud.scale.setScalar(rand(4, 8));
        cloud.userData.spin = rand(-0.02, 0.02);
        far.add(cloud);
        clouds.push(cloud);
    }

    // Glitter stays put in the world so the rider flies through it,
    // and anything left too far behind reappears around the rider
    const glitterPos = new Float32Array(GLITTER_COUNT * 3);
    const glitterGeo = new THREE.BufferGeometry();
    glitterGeo.setAttribute('position', new THREE.BufferAttribute(glitterPos, 3));
    scene.add(new THREE.Points(glitterGeo, new THREE.PointsMaterial({
        color: 0xfff0ff, size: 0.2, map: glowTex, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending
    })));
    let seeded = false;

    function respawn(i, center) {
        glitterPos[i * 3] = center.x + rand(-GLITTER_RANGE, GLITTER_RANGE);
        glitterPos[i * 3 + 1] = center.y + rand(-6, 16);
        glitterPos[i * 3 + 2] = center.z + rand(-GLITTER_RANGE, GLITTER_RANGE);
    }

    function update(dt, riderPos) {
        far.position.copy(riderPos);
        for (const cloud of clouds) cloud.rotation.y += cloud.userData.spin * dt;

        for (let i = 0; i < GLITTER_COUNT; i++) {
            if (!seeded) {
                respawn(i, riderPos);
                continue;
            }
            glitterPos[i * 3 + 1] -= dt * 1.2;
            if (Math.abs(glitterPos[i * 3] - riderPos.x) > GLITTER_RANGE
                || Math.abs(glitterPos[i * 3 + 2] - riderPos.z) > GLITTER_RANGE
                || glitterPos[i * 3 + 1] < riderPos.y - 8) {
                respawn(i, riderPos);
            }
        }
        seeded = true;
        glitterGeo.attributes.position.needsUpdate = true;
    }

    return { update };
}
