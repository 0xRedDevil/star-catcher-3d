// Skins: a whole set of obstacle models that can be swapped at once.
// Every skin fills the same roles, at the same sizes, so the game plays the same.
import * as THREE from 'three';
import { KIND_RADIUS } from './placement.js';
import {
    makeCrystalPine, makeToadstool, makeMoonRock, makeSnowman, makeFairyHouse, makeStormCloud,
    makeRollingPlanet, makeGlow, propMat, boltGeo, boltMat, pick, rand
} from './models.js';

export const SKINS = {
    forest: {
        id: 'forest',
        name: 'Fairy Forest',
        obstacles: {
            tall: makeCrystalPine,
            cluster: makeToadstool,
            rock: makeMoonRock,
            buddy: makeSnowman,
            station: makeFairyHouse,
            floater: makeStormCloud,
            planet: makeRollingPlanet,
        },
    },
};
export const DEFAULT_SKIN = 'forest';

// Each model maker returns { geo, radius } and, optionally:
//   faceCamera: true        it faces the rider
//   spin: radians/second    it turns slowly
//   bob: speed              it bobs gently up and down
//   glows: [{ color, size, opacity, pos: [x, y, z], blink? }]   glowing lights, some blinking
//   bolt: true              a lightning bolt hangs underneath
const variants = {};

// One random, cached variant of a role in a skin, scaled to fit its placement size
export function obstacleModel(role, skinId = DEFAULT_SKIN) {
    const key = `${skinId}:${role}`;
    variants[key] ??= Array.from({ length: 5 }, SKINS[skinId].obstacles[role]);
    const variant = pick(variants[key]);
    const scale = Math.min(KIND_RADIUS[role] / variant.radius, 1.2) * rand(0.85, 1);

    const object = new THREE.Group();
    const model = new THREE.Group();   // the game turns this to face a random way
    model.scale.setScalar(scale);
    const mover = new THREE.Group();   // spins and bobs
    mover.add(new THREE.Mesh(variant.geo, propMat));
    model.add(mover);
    object.add(model);

    if (variant.bolt) {
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(0, -0.6, 0.2);
        bolt.scale.setScalar(1.3);
        model.add(bolt);
    }
    const lights = (variant.glows || []).map(g => {
        const glow = makeGlow(g.color, g.size, g.opacity);
        glow.position.set(...g.pos);
        mover.add(glow);
        return { glow, g, phase: rand(0, Math.PI * 2) };
    });

    const spinStart = rand(0, Math.PI * 2);
    const bobPhase = rand(0, Math.PI * 2);
    object.userData.update = (time) => {
        if (variant.spin) mover.rotation.y = spinStart + time * variant.spin;
        if (variant.bob) mover.position.y = Math.sin(time * variant.bob + bobPhase) * 0.06;
        for (const { glow, g, phase } of lights) {
            if (g.blink) glow.material.opacity = g.opacity * (0.55 + 0.45 * Math.sin(time * g.blink + phase));
        }
    };
    object.userData.faceRider = !!variant.faceCamera;
    object.userData.model = model;
    return { object, radius: variant.radius * scale };
}
