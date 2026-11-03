// Shared models: glow sprites, low-poly model baking, obstacles, stars and hearts
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { KIND_RADIUS } from './placement.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeGlowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}
export const glowTex = makeGlowTexture();

export function makeGlow(color, size, opacity = 0.6) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false
    }));
    sprite.scale.setScalar(size);
    return sprite;
}

// Low-poly model building: every model is baked into one geometry with
// vertex colours, so each obstacle is a single cheap draw call.
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// A lumpy, hand-made looking version of a shape
export function rough(geo, amount) {
    let g = geo.clone();
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i,
            pos.getX(i) * (1 + (Math.random() - 0.5) * amount),
            pos.getY(i) * (1 + (Math.random() - 0.5) * amount),
            pos.getZ(i) * (1 + (Math.random() - 0.5) * amount));
    }
    g = g.toNonIndexed();
    g.computeVertexNormals();
    return g;
}

export function part(geo, color, { x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0 } = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (!g.attributes.normal) g.computeVertexNormals();
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g.applyMatrix4(_m);
    const c = new THREE.Color(color);
    const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
        colors[i] = c.r;
        colors[i + 1] = c.g;
        colors[i + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
}

export function bake(parts) {
    const g = mergeGeometries(parts);
    parts.forEach(p => p.dispose());
    return g;
}

export const G = {
    ico: new THREE.IcosahedronGeometry(1, 0),
    dodec: new THREE.DodecahedronGeometry(1, 0),
    octa: new THREE.OctahedronGeometry(1, 0),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 7),
    taper: new THREE.CylinderGeometry(0.7, 1, 1, 7),
    cone: new THREE.ConeGeometry(1, 1, 7),
    cap: new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2),
    disk: new THREE.CircleGeometry(1, 9),
    torus: new THREE.TorusGeometry(1, 0.35, 4, 9),
    box: new THREE.BoxGeometry(1, 1, 1),
};
export const lump = (amount = 0.2) => rough(new THREE.IcosahedronGeometry(1, 1), amount);

export const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 });

// Obstacle models for stage 2. Each maker builds one random variant.
export function makeToadstool() {
    const capColor = pick([0xff3b5c, 0xb44dff, 0xff6ec7, 0x3fb8ff, 0xffa23b]);
    const h = rand(0.7, 1.5);
    const r = rand(0.6, 1.0);
    const parts = [
        part(G.taper, 0xfff1e0, { y: h / 2, sx: r * 0.28, sy: h, sz: r * 0.28 }),
        part(G.cap, capColor, { y: h, sx: r, sy: r * 0.7, sz: r }),
        part(G.disk, 0xffd9ec, { y: h + 0.01, sx: r * 0.98, rx: Math.PI / 2 }),
    ];
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + rand(0, 0.5);
        const e = rand(0.35, 1.0);
        parts.push(part(G.ico, 0xffffff, {
            x: Math.cos(a) * Math.cos(e) * r, y: h + Math.sin(e) * r * 0.7, z: Math.sin(a) * Math.cos(e) * r, sx: r * 0.13
        }));
    }
    return { geo: bake(parts), radius: r * 0.9 };
}

export function makeCandyTree() {
    const palette = pick([[0xffb3e6, 0xff8fd6], [0xa8f0d8, 0x7fe0c0], [0xd7b3ff, 0xbf8fff], [0xffd1a8, 0xffb37f]]);
    const h = rand(1.3, 2.0);
    const parts = [part(G.taper, 0x8a5a8e, { y: h / 2, sx: 0.16, sy: h, sz: 0.16 })];
    const puffs = [[0, h + 0.4, 0, 0.95], [-0.6, h + 0.05, 0.15, 0.65], [0.6, h + 0.1, -0.1, 0.7], [0.1, h + 1.0, 0, 0.6]];
    puffs.forEach(([x, y, z, s], i) => parts.push(part(lump(0.25), palette[i % 2], { x, y, z, sx: s })));
    return { geo: bake(parts), radius: 1.0 };
}

export function makeCrystalPine() {
    const tones = pick([[0x5fd3e8, 0xc9f6ff], [0x6fe3b5, 0xd4fff0], [0xff8fcf, 0xffe0f2], [0x9b8cff, 0xe2dcff]]);
    const tiers = Math.random() < 0.5 ? 3 : 4;
    const parts = [part(G.cyl, 0x6b4a7a, { y: 0.3, sx: 0.15, sy: 0.6, sz: 0.15 })];
    for (let i = 0; i < tiers; i++) {
        const r = 1.0 - i * 0.2;
        const y = 0.6 + i * 0.65;
        parts.push(part(G.cone, tones[0], { y: y + 0.55, sx: r, sy: 1.1, sz: r, ry: i * 0.4 }));
        // Frosty skirt on each tier
        parts.push(part(G.cone, tones[1], { y: y + 0.18, sx: r * 1.05, sy: 0.3, sz: r * 1.05, ry: i * 0.4 }));
    }
    parts.push(part(G.octa, 0xffe066, { y: 0.6 + (tiers - 1) * 0.65 + 1.25, sx: 0.16, sy: 0.22 }));
    return { geo: bake(parts), radius: 0.85 };
}

export function makeMoonRock() {
    const colors = [0x8c82b0, 0x9fb4d8, 0xb59ad6, 0x7a8aa8];
    const parts = [];
    const count = Math.random() < 0.5 ? 1 : 2;
    let radius = 0;
    for (let i = 0; i < count; i++) {
        const s = i === 0 ? 1 : 0.6;
        const sx = rand(0.6, 1.0) * s;
        const sy = rand(0.45, 0.85) * s;
        const sz = rand(0.6, 1.0) * s;
        const x = i === 0 ? 0 : pick([-1, 1]) * rand(0.7, 0.9);
        parts.push(part(pick([G.ico, G.dodec, G.octa]), pick(colors), { x, y: sy * 0.6, sx, sy, sz, rx: rand(0, 3), ry: rand(0, 3) }));
        // Snowy cap
        parts.push(part(G.ico, 0xf3eeff, { x, y: sy * 1.15, sx: sx * 0.75, sy: sy * 0.25, sz: sz * 0.75, ry: rand(0, 3) }));
        radius = Math.max(radius, Math.abs(x) + sx);
    }
    if (Math.random() < 0.6) {
        parts.push(part(G.octa, 0x7ff0ff, { x: 0.3, y: 0.9, sx: 0.12, sy: 0.35, rz: 0.3 }));
    }
    return { geo: bake(parts), radius: radius * 0.9 };
}

export function makeSnowman() {
    const scarf = pick([0xff5fa2, 0x5fe0c0, 0xffc23b]);
    const hat = pick([0x7b3fe4, 0x3f6fe4, 0xe43f9b]);
    const snow = 0xf5f3ff;
    const parts = [
        part(lump(0.15), snow, { y: 0.5, sx: 0.55 }),
        part(lump(0.15), snow, { y: 1.18, sx: 0.4 }),
        part(lump(0.12), snow, { y: 1.72, sx: 0.3 }),
        part(G.ico, 0x222233, { x: -0.1, y: 1.8, z: 0.26, sx: 0.045 }),
        part(G.ico, 0x222233, { x: 0.1, y: 1.8, z: 0.26, sx: 0.045 }),
        part(G.cone, 0xff8a2b, { y: 1.72, z: 0.38, sx: 0.05, sy: 0.25, rx: Math.PI / 2 }),
        part(G.ico, 0x222233, { y: 1.25, z: 0.39, sx: 0.04 }),
        part(G.ico, 0x222233, { y: 1.05, z: 0.39, sx: 0.04 }),
        part(G.torus, scarf, { y: 1.48, sx: 0.3, rx: Math.PI / 2 }),
        part(G.cyl, hat, { y: 1.97, sx: 0.38, sy: 0.04, sz: 0.38 }),
        part(G.cone, hat, { y: 2.27, sx: 0.26, sy: 0.6, sz: 0.26, rz: 0.15 }),
        part(G.octa, 0xffe066, { x: -0.07, y: 2.58, sx: 0.07 }),
    ];
    return { geo: bake(parts), radius: 0.6, faceCamera: true };
}

export function makeFairyHouse() {
    const roof = pick([0xff5f8f, 0x8f5fff, 0x3fc6a8, 0xffa23b]);
    const parts = [
        part(G.cyl, 0xe8d9ff, { y: 0.7, sx: 0.7, sy: 1.4, sz: 0.7 }),
        part(G.cone, roof, { y: 1.85, sx: 0.95, sy: 1.0, sz: 0.95 }),
        part(G.box, 0x7a4a2a, { y: 0.35, z: 0.66, sx: 0.32, sy: 0.6, sz: 0.1 }),
        part(G.box, 0xffe27a, { x: 0.3, y: 1.0, z: 0.6, sx: 0.22, sy: 0.22, sz: 0.1, ry: 0.4 }),
        part(G.box, 0xffe27a, { x: -0.3, y: 1.0, z: 0.6, sx: 0.22, sy: 0.22, sz: 0.1, ry: -0.4 }),
    ];
    return { geo: bake(parts), radius: 0.85, faceCamera: true, windowGlow: true };
}

export function makeStormCloud() {
    const parts = [];
    [[0, 0, 0, 0.6], [-0.55, -0.1, 0, 0.45], [0.55, -0.1, 0, 0.45], [-0.25, 0.28, -0.05, 0.42], [0.3, 0.25, 0, 0.4]]
        .forEach(([x, y, z, s]) => parts.push(part(lump(0.25), pick([0x5f6485, 0x6a6f8f, 0x575b7a]), { x, y, z, sx: s })));
    return { geo: bake(parts), radius: 0.95 };
}

// A low-poly planet with coloured bands and, sometimes, a tilted ring
export function makeBandedPlanet({ radius, palette, ringColor = null, ringTilt = 0.4 }) {
    const sphere = new THREE.IcosahedronGeometry(radius, 1);
    sphere.deleteAttribute('uv');
    const pos = sphere.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 3) {
        // Colour each triangle by the band its middle sits in
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const band = Math.min(palette.length - 1, Math.floor(((y / radius) + 1) / 2 * palette.length));
        c.set(palette[band]);
        for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
    }
    sphere.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const parts = [sphere];
    if (ringColor !== null) {
        // Ring reaches out to about 1.42 × the planet's radius
        parts.push(part(G.torus, ringColor, { sx: radius * 1.05, sy: radius * 1.05, sz: radius * 0.2, rx: Math.PI / 2, rz: ringTilt }));
    }
    return bake(parts);
}

export function makeRollingPlanet() {
    const palette = pick([
        [0xff8fcf, 0xffd1ec, 0xff5fa2, 0xffd1ec],
        [0x7fd6ff, 0xd0f2ff, 0x4aa8ff, 0xd0f2ff],
        [0xffc46b, 0xfff0c9, 0xff9f43, 0xfff0c9],
        [0xb79bff, 0xe8deff, 0x8a5cff, 0xe8deff],
    ]);
    // Sphere 0.45 plus a ring reaching about 0.64 keeps it inside its placement size
    const geo = makeBandedPlanet({ radius: 0.45, palette, ringColor: 0xfff3c4, ringTilt: rand(-0.4, 0.4) });
    return { geo, radius: 0.64 };
}

// One random, cached variant of each obstacle kind, scaled to fit its placement size
const MAKERS = {
    crystalPine: makeCrystalPine,
    toadstool: makeToadstool,
    moonRock: makeMoonRock,
    snowman: makeSnowman,
    fairyHouse: makeFairyHouse,
    stormCloud: makeStormCloud,
    planet: makeRollingPlanet,
};
const variants = {};

export function obstacleModel(kind) {
    variants[kind] ??= Array.from({ length: 5 }, MAKERS[kind]);
    const variant = pick(variants[kind]);
    const scale = Math.min(KIND_RADIUS[kind] / variant.radius, 1.2) * rand(0.85, 1);
    const object = new THREE.Group();
    const model = new THREE.Group();
    model.scale.setScalar(scale);
    model.add(new THREE.Mesh(variant.geo, propMat));
    if (kind === 'stormCloud') {
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.set(0, -0.6, 0.2);
        bolt.scale.setScalar(1.3);
        model.add(bolt);
    }
    if (variant.windowGlow) {
        const glow = makeGlow(0xffd27a, 1.6, 0.6);
        glow.position.set(0, 1.0, 0.7);
        model.add(glow);
    }
    object.add(model);
    object.userData.faceRider = !!variant.faceCamera;
    object.userData.model = model;
    return { object, radius: variant.radius * scale };
}

// Stars, hearts and lightning bolts
function starShape(outer, inner, points = 5) {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = Math.PI / 2 + (i * Math.PI) / points;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) s.moveTo(x, y);
        else s.lineTo(x, y);
    }
    s.closePath();
    return s;
}

function heartShape() {
    const s = new THREE.Shape();
    s.moveTo(5, 5);
    s.bezierCurveTo(5, 5, 4, 0, 0, 0);
    s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
    s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
    s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
    s.bezierCurveTo(16, 7, 16, 0, 10, 0);
    s.bezierCurveTo(7, 0, 5, 5, 5, 5);
    return s;
}

function boltShape() {
    const s = new THREE.Shape();
    s.moveTo(0.05, 0.3);
    s.lineTo(-0.15, -0.02);
    s.lineTo(0.0, -0.02);
    s.lineTo(-0.1, -0.35);
    s.lineTo(0.15, 0.06);
    s.lineTo(0.0, 0.06);
    s.closePath();
    return s;
}

export const starGeo = new THREE.ExtrudeGeometry(starShape(0.5, 0.22), {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2
});
starGeo.center();
export const starMat = new THREE.MeshStandardMaterial({
    color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.35
});

export const heartGeo = new THREE.ExtrudeGeometry(heartShape(), {
    depth: 4, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 3
});
heartGeo.center();
heartGeo.rotateZ(Math.PI); // the shape is drawn upside down
heartGeo.scale(0.045, 0.045, 0.045);
export const heartMat = new THREE.MeshStandardMaterial({
    color: 0xff3366, emissive: 0xaa1144, emissiveIntensity: 0.6, roughness: 0.4
});

export const boltGeo = new THREE.ShapeGeometry(boltShape());
export const boltMat = new THREE.MeshBasicMaterial({ color: 0xffee55, side: THREE.DoubleSide });

