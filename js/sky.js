// Space around the track: stars, the moon, planets, nebula glows, comets,
// shooting stars and falling glitter. The far-away parts follow the rider,
// so space always surrounds the track.
import * as THREE from 'three';
import { glowTex, makeGlow, makeBandedPlanet, rand, pick } from './models.js';

const GLITTER_COUNT = 500;
const GLITTER_RANGE = 30;   // glitter is kept within this box around the rider
const COMET_COUNT = 2;

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

// A point somewhere on a big sphere around the rider, mostly near the horizon
function skyPoint(distance, minY = -0.5, maxY = 0.7) {
    const a = rand(0, Math.PI * 2);
    const y = rand(minY, maxY);
    const flat = Math.sqrt(1 - y * y);
    return new THREE.Vector3(Math.cos(a) * flat * distance, y * distance, Math.sin(a) * flat * distance);
}

function farGlow(color, size, opacity) {
    const glow = makeGlow(color, size, opacity);
    glow.material.fog = false;
    return glow;
}

export function createSky(scene) {
    const far = new THREE.Group();
    scene.add(far);
    far.add(makeStarfield(1800, 250));

    // The moon
    const moon = new THREE.Mesh(
        new THREE.IcosahedronGeometry(9, 2),
        new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false })
    );
    moon.position.set(-60, 55, -230);
    far.add(moon);
    const moonGlow = farGlow(0xffe9a8, 50, 0.5);
    moonGlow.position.copy(moon.position);
    far.add(moonGlow);

    // Planets, some with rings
    const planetMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, fog: false });
    const planetLooks = [
        { palette: [0xff8fcf, 0xffd1ec, 0xd94fa0, 0xffd1ec, 0xff8fcf], ringColor: 0xfff3c4 },
        { palette: [0x5fd3e8, 0x2f7fbf, 0x9fe8f5, 0x2f7fbf], ringColor: null },
        { palette: [0xffc46b, 0xe0803a, 0xfff0c9, 0xe0803a, 0xffc46b], ringColor: 0xd9c9ff },
        { palette: [0x9b7bff, 0x5a3fbf, 0xd2c4ff], ringColor: null },
        { palette: [0x6fe3b5, 0x2f9f7f, 0xc9ffe8, 0x2f9f7f], ringColor: 0xffffff },
    ];
    const planets = planetLooks.map((look, i) => {
        const planet = new THREE.Mesh(makeBandedPlanet({ radius: 1, ringTilt: rand(-0.6, 0.6), ...look }), planetMat);
        planet.name = 'planet';
        planet.position.copy(skyPoint(rand(160, 260), -0.3, 0.6));
        planet.scale.setScalar(i === 0 ? 22 : rand(7, 16));
        planet.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI * 2), rand(-0.3, 0.3));
        planet.userData.spin = rand(0.01, 0.04);
        far.add(planet);
        return planet;
    });

    // Soft coloured nebula glows
    for (let i = 0; i < 6; i++) {
        const nebula = farGlow(pick([0xff5fd2, 0x4fd8ff, 0x9b6bff, 0xff9fd0]), rand(120, 200), rand(0.12, 0.22));
        nebula.position.copy(skyPoint(240, -0.4, 0.8));
        far.add(nebula);
    }

    // Comets drift slowly across the sky, tail pointing away from where they're heading
    const tailGeo = new THREE.ConeGeometry(1.2, 28, 8, 1, true);
    tailGeo.translate(0, -14, 0);
    const tailMat = new THREE.MeshBasicMaterial({
        color: 0xbfe8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, side: THREE.DoubleSide
    });
    const comets = Array.from({ length: COMET_COUNT }, () => {
        const comet = new THREE.Group();
        comet.add(farGlow(0xe8f6ff, 9, 0.9));
        const tail = new THREE.Mesh(tailGeo, tailMat);
        comet.add(tail);
        far.add(comet);
        const c = { comet, tail, velocity: new THREE.Vector3() };
        resetComet(c);
        return c;
    });

    function resetComet(c) {
        c.comet.position.copy(skyPoint(rand(170, 220), 0.1, 0.7));
        c.velocity.set(rand(-1, 1), rand(-0.3, 0.1), rand(-1, 1)).normalize().multiplyScalar(rand(3, 6));
        // Point the tail (local -y) away from the direction of travel
        c.tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.velocity.clone().normalize());
    }

    // An occasional shooting star streaking across
    const streakPos = new Float32Array(6);
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
    const streakMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false });
    const streak = new THREE.Line(streakGeo, streakMat);
    streak.frustumCulled = false;
    far.add(streak);
    let streakLife = 0;
    let streakWait = rand(2, 5);
    const streakHead = new THREE.Vector3();
    const streakDir = new THREE.Vector3();

    // Glitter stays put in the world so the rider flies through it,
    // and anything left too far behind reappears around the rider
    const glitterPos = new Float32Array(GLITTER_COUNT * 3);
    const glitterGeo = new THREE.BufferGeometry();
    glitterGeo.setAttribute('position', new THREE.BufferAttribute(glitterPos, 3));
    const glitter = new THREE.Points(glitterGeo, new THREE.PointsMaterial({
        color: 0xfff0ff, size: 0.2, map: glowTex, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending
    }));
    // Its bounds are only worked out once, at the start, so culling would hide it later
    glitter.frustumCulled = false;
    scene.add(glitter);
    let seeded = false;

    function respawn(i, center) {
        glitterPos[i * 3] = center.x + rand(-GLITTER_RANGE, GLITTER_RANGE);
        glitterPos[i * 3 + 1] = center.y + rand(-6, 16);
        glitterPos[i * 3 + 2] = center.z + rand(-GLITTER_RANGE, GLITTER_RANGE);
    }

    function update(dt, riderPos) {
        far.position.copy(riderPos);
        for (const planet of planets) planet.rotation.y += planet.userData.spin * dt;

        for (const c of comets) {
            c.comet.position.addScaledVector(c.velocity, dt);
            if (c.comet.position.length() > 280) resetComet(c);
        }

        streakWait -= dt;
        if (streakWait <= 0 && streakLife <= 0) {
            streakHead.copy(skyPoint(150, 0.15, 0.6));
            streakDir.set(rand(-1, 1), rand(-0.6, -0.2), rand(-1, 1)).normalize();
            streakLife = 0.7;
            streakWait = rand(4, 8);
        }
        if (streakLife > 0) {
            streakLife -= dt;
            streakHead.addScaledVector(streakDir, 90 * dt);
            streakPos.set([streakHead.x, streakHead.y, streakHead.z], 0);
            streakPos.set([streakHead.x - streakDir.x * 14, streakHead.y - streakDir.y * 14, streakHead.z - streakDir.z * 14], 3);
            streakGeo.attributes.position.needsUpdate = true;
            streakMat.opacity = Math.max(0, Math.min(1, streakLife / 0.3));
        }

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
