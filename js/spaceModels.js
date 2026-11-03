// The Space Friends skin: cute low-poly space things to dodge.
// Each maker builds one random variant; see skins.js for what the returned fields mean.
import * as THREE from 'three';
import { G, part, bake, lump, rand, pick, widthOf } from './models.js';

const sphere = new THREE.SphereGeometry(1, 14, 8);
const DARK = 0x222233;

// A little flying saucer with an alien peeking out of the top and blinking rim lights
export function makeUfo() {
    const hull = pick([0xc9c2e8, 0xb8e0ff, 0xffc2e2]);
    const rim = pick([0xff5fa2, 0x5fb3ff, 0xffb347, 0x9b7bff]);
    const alien = pick([0x7ee08a, 0xb48cff, 0x6fd6e8]);
    const parts = [
        part(sphere, hull, { sx: 0.9, sy: 0.22, sz: 0.9 }),
        part(G.torus, rim, { sx: 0.7, sy: 0.7, sz: 0.3, rx: Math.PI / 2 }),
        part(G.torus, 0xe8e8f5, { y: 0.18, sx: 0.3, sy: 0.3, sz: 0.2, rx: Math.PI / 2 }),
        // The alien pilot: round head, one big eye and two antennae
        part(sphere, alien, { y: 0.34, sx: 0.26 }),
        part(sphere, 0xffffff, { y: 0.4, z: 0.2, sx: 0.11 }),
        part(sphere, DARK, { y: 0.41, z: 0.29, sx: 0.055 }),
        part(G.cyl, alien, { x: -0.12, y: 0.66, sx: 0.02, sy: 0.22, sz: 0.02, rz: 0.3 }),
        part(G.cyl, alien, { x: 0.12, y: 0.66, sx: 0.02, sy: 0.22, sz: 0.02, rz: -0.3 }),
        part(sphere, 0xff8fd8, { x: -0.16, y: 0.78, sx: 0.05 }),
        part(sphere, 0xff8fd8, { x: 0.16, y: 0.78, sx: 0.05 }),
    ];
    const glows = [];
    for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        const color = [0xffe066, 0xff8fd8, 0x9fe8ff][i % 3];
        parts.push(part(sphere, color, { x: Math.cos(a) * 0.72, z: Math.sin(a) * 0.72, sx: 0.06 }));
        glows.push({ color, size: 0.45, opacity: 0.9, pos: [Math.cos(a) * 0.72, 0, Math.sin(a) * 0.72], blink: 5 + i });
    }
    glows.push({ color: 0x9fe8ff, size: 1.6, opacity: 0.35, pos: [0, -0.35, 0] }); // soft glow underneath
    return { geo: bake(parts), radius: 0.95, spin: 0.8, glows };
}

// A friendly little alien standing on the track, waving
export function makeAlien() {
    const skin = pick([0x7ee08a, 0xb48cff, 0x6fd6e8, 0xff9fd0]);
    const feet = pick([0x5aa868, 0x8a68cc, 0x4aa8b8, 0xd977aa]);
    const parts = [
        part(lump(0.1), skin, { y: 0.45, sx: 0.5, sy: 0.45, sz: 0.48 }),
        part(sphere, feet, { x: -0.2, y: 0.06, z: 0.15, sx: 0.14 }),
        part(sphere, feet, { x: 0.2, y: 0.06, z: 0.15, sx: 0.14 }),
        part(sphere, skin, { x: -0.48, y: 0.45, sx: 0.12 }),          // arm down
        part(sphere, skin, { x: 0.46, y: 0.7, sx: 0.12 }),            // arm up, waving
        part(G.box, DARK, { y: 0.36, z: 0.45, sx: 0.16, sy: 0.035, sz: 0.03 }), // smile
        part(G.cyl, skin, { x: -0.16, y: 0.98, sx: 0.025, sy: 0.3, sz: 0.025, rz: 0.3 }),
        part(G.cyl, skin, { x: 0.16, y: 0.98, sx: 0.025, sy: 0.3, sz: 0.025, rz: -0.3 }),
        part(sphere, 0xffe066, { x: -0.21, y: 1.14, sx: 0.07 }),
        part(sphere, 0xffe066, { x: 0.21, y: 1.14, sx: 0.07 }),
    ];
    if (Math.random() < 0.5) {
        // One big eye
        parts.push(part(sphere, 0xffffff, { y: 0.6, z: 0.36, sx: 0.2 }));
        parts.push(part(sphere, DARK, { y: 0.62, z: 0.53, sx: 0.1 }));
    } else {
        for (const side of [-1, 1]) {
            parts.push(part(sphere, 0xffffff, { x: side * 0.15, y: 0.62, z: 0.36, sx: 0.12 }));
            parts.push(part(sphere, DARK, { x: side * 0.15, y: 0.63, z: 0.46, sx: 0.06 }));
        }
    }
    const glows = [-1, 1].map(side => ({ color: 0xffe066, size: 0.35, opacity: 0.9, pos: [side * 0.21, 1.14, 0], blink: 3 }));
    return { geo: bake(parts), radius: 0.6, faceCamera: true, bob: 3, glows };
}

// A chubby toy rocket on its fins, with a round window and a flickering flame
export function makeRocket() {
    const body = pick([0xffffff, 0xffe9f5, 0xe8f4ff]);
    const trim = pick([0xff5f8f, 0x5fb3ff, 0xffb347, 0x9b7bff]);
    const parts = [
        part(G.cyl, body, { y: 1.05, sx: 0.32, sy: 1.3, sz: 0.32 }),
        part(G.cone, trim, { y: 2.0, sx: 0.32, sy: 0.6, sz: 0.32 }),
        part(G.cyl, trim, { y: 0.75, sx: 0.335, sy: 0.12, sz: 0.335 }),
        part(G.cyl, 0x9fe8ff, { y: 1.35, z: 0.3, sx: 0.14, sy: 0.05, sz: 0.14, rx: Math.PI / 2 }),
        part(G.torus, 0xd9d9e8, { y: 1.35, z: 0.31, sx: 0.15, sy: 0.15, sz: 0.1 }),
        part(G.taper, 0x6b6b80, { y: 0.3, sx: 0.2, sy: 0.2, sz: 0.2 }),
        part(G.cone, 0xffa23b, { y: 0.1, sx: 0.13, sy: 0.25, sz: 0.13, rx: Math.PI }),
    ];
    for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3 + Math.PI / 2;
        parts.push(part(G.box, trim, {
            x: Math.cos(a) * 0.42, y: 0.35, z: Math.sin(a) * 0.42, sx: 0.06, sy: 0.55, sz: 0.4, ry: Math.PI / 2 - a
        }));
    }
    const glows = [{ color: 0xffb347, size: 1.1, opacity: 0.75, pos: [0, 0.05, 0], blink: 14 }];
    return { geo: bake(parts), radius: 0.62, faceCamera: true, glows };
}

// A little satellite on a pole, with solar panels, a dish and a blinking light
export function makeSatellite() {
    const parts = [
        part(G.cyl, 0x9a9ab0, { y: 0.45, sx: 0.05, sy: 0.9, sz: 0.05 }),
        part(G.box, pick([0xffd27a, 0xe8e8f5, 0xffb3d9]), { y: 1.05, sx: 0.4, sy: 0.4, sz: 0.4 }),
        part(G.cap, 0xf0f0ff, { y: 1.35, sx: 0.26, sy: 0.14, sz: 0.26, rx: Math.PI }),
        part(sphere, 0xd9d9e8, { y: 1.42, sx: 0.04 }),
    ];
    for (const side of [-1, 1]) {
        parts.push(part(G.box, 0xd9d9e8, { x: side * 0.27, y: 1.05, sx: 0.14, sy: 0.03, sz: 0.03 }));
        parts.push(part(G.box, 0x4a7bff, { x: side * 0.62, y: 1.05, sx: 0.44, sy: 0.03, sz: 0.32 }));
        for (const z of [-0.08, 0.08]) {
            parts.push(part(G.box, 0x9fc4ff, { x: side * 0.62, y: 1.06, z, sx: 0.44, sy: 0.035, sz: 0.02 }));
        }
    }
    const glows = [{ color: 0xff4d6d, size: 0.5, opacity: 0.9, pos: [0, 1.55, 0], blink: 5 }];
    return { geo: bake(parts), radius: 0.84, spin: 0.6, glows };
}

// A cluster of glowing space crystals on a little rock
export function makeSpaceCrystals() {
    const [main, light] = pick([[0xff8fd8, 0xffc2ec], [0x6fe8ff, 0xc2f6ff], [0xffd86b, 0xfff0b8], [0xb79bff, 0xe2d6ff]]);
    const parts = [
        part(lump(0.3), 0x6b5a9a, { y: 0.1, sx: 0.6, sy: 0.18, sz: 0.55 }),
        part(G.octa, main, { y: 0.7, sx: 0.2, sy: 0.65, sz: 0.2 }),
    ];
    for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI * 2) / 4 + rand(-0.3, 0.3);
        const h = rand(0.35, 0.5);
        parts.push(part(G.octa, i % 2 ? light : main, {
            x: Math.cos(a) * 0.3, y: 0.15 + h, z: Math.sin(a) * 0.3,
            sx: 0.13, sy: h, sz: 0.13, rx: Math.sin(a) * 0.4, rz: -Math.cos(a) * 0.4
        }));
    }
    const glows = [{ color: main, size: 1.7, opacity: 0.45, pos: [0, 0.6, 0], blink: 2 }];
    return { geo: bake(parts), radius: 0.7, glows };
}

// A moon rock with little craters (sometimes two rocks together)
export function makeCraterRock() {
    const colors = [0x9a90bd, 0xa9b8d8, 0xbba5dd, 0x8a94b0];
    const parts = [];
    const count = Math.random() < 0.5 ? 1 : 2;
    for (let i = 0; i < count; i++) {
        const s = i === 0 ? 1 : 0.6;
        const sx = rand(0.65, 0.95) * s;
        const sy = rand(0.45, 0.75) * s;
        const sz = rand(0.65, 0.95) * s;
        const x = i === 0 ? 0 : pick([-1, 1]) * rand(0.7, 0.9);
        parts.push(part(lump(0.2), pick(colors), { x, y: sy * 0.7, sx, sy, sz }));
        // Craters dotted over the top
        for (let c = 0; c < 3; c++) {
            const a = rand(0, Math.PI * 2);
            const d = rand(0.15, 0.45);
            const r = rand(0.1, 0.18) * s;
            parts.push(part(G.cyl, 0x6f6890, {
                x: x + Math.cos(a) * d * sx, y: sy * 0.7 + sy * Math.sqrt(Math.max(0, 1 - d * d)) - 0.02,
                z: Math.sin(a) * d * sz, sx: r, sy: 0.04, sz: r
            }));
        }
    }
    // Lumpy rocks bulge, so measure the real width rather than guessing it
    const geo = bake(parts);
    return { geo, radius: widthOf(geo) };
}
