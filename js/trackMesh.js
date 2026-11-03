// Turns the track's frames into the road and its see-through walls, a chunk at a time
import * as THREE from 'three';
import { TRACK_HALF_WIDTH } from './track.js';

export const CHUNK_LENGTH = 50;
export const WALL_HEIGHT = 0.8;
const KEEP_BEHIND = 20;
const KEEP_AHEAD = 150;
const STRIPE_LENGTH = 8;   // track units per repeat of the road texture
const EDGE_BAND = 0.5;     // width of the bright band just inside each wall on the glass road

// The everyday road: see-through glowing purple glass, so space shows through
export const PURPLE_STYLE = { road: 'glass', color: 0x8a4dff, opacity: 0.45, edgeColor: 0xe0b8ff, wallColor: 0xff77ff };
// Saved for special zones
export const RAINBOW_STYLE = {
    road: 'stripes',
    colors: ['#ff4d6d', '#ff9f43', '#ffe66d', '#4ade80', '#38bdf8', '#a78bfa'],
    wallColor: 0xff77ff,
};

// Faint lines and sparkles in the glass, so you can feel the speed
function makeGlassTexture() {
    if (typeof document === 'undefined') return null; // tests run in Node
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255, 220, 255, 1)';
    g.fillRect(0, 28, c.width, 6);
    g.fillRect(126, 0, 4, c.height);
    for (let i = 0; i < 18; i++) g.fillRect(Math.random() * c.width, Math.random() * c.height, 3, 3);
    // A gentle darker middle, so the brighter edges stand out
    const shade = g.createLinearGradient(0, 0, c.width, 0);
    shade.addColorStop(0, 'rgba(120, 60, 200, 0)');
    shade.addColorStop(0.5, 'rgba(120, 60, 200, 0.35)');
    shade.addColorStop(1, 'rgba(120, 60, 200, 0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

function makeRoadTexture(colors) {
    if (typeof document === 'undefined') return null; // tests run in Node
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    const w = c.width / colors.length;
    colors.forEach((col, i) => {
        g.fillStyle = col;
        g.fillRect(i * w, 0, w + 1, c.height);
    });
    // Soft white lines between the stripes and a sparkle band across the road
    g.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 1; i < colors.length; i++) g.fillRect(i * w - 1.5, 0, 3, c.height);
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.fillRect(0, 28, c.width, 8);
    // Darker edges so the road reads against space
    const edge = g.createLinearGradient(0, 0, c.width, 0);
    edge.addColorStop(0, 'rgba(40, 10, 70, 0.6)');
    edge.addColorStop(0.08, 'rgba(40, 10, 70, 0)');
    edge.addColorStop(0.92, 'rgba(40, 10, 70, 0)');
    edge.addColorStop(1, 'rgba(40, 10, 70, 0.6)');
    g.fillStyle = edge;
    g.fillRect(0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Materials are shared by every chunk and created once per style
function materialsFor(style) {
    if (!style._materials) {
        let road;
        let edge = null;
        if (style.road === 'glass') {
            road = new THREE.MeshBasicMaterial({
                map: makeGlassTexture(), color: style.color, transparent: true, opacity: style.opacity,
                depthWrite: false, side: THREE.DoubleSide
            });
            edge = new THREE.MeshBasicMaterial({
                color: style.edgeColor, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide
            });
        } else {
            const map = makeRoadTexture(style.colors);
            road = new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : style.colors[0], side: THREE.DoubleSide });
        }
        style._materials = {
            road,
            edge,
            wall: new THREE.MeshBasicMaterial({
                color: style.wallColor, transparent: true, opacity: 0.22,
                blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
            }),
            wallEdge: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
        };
    }
    return style._materials;
}

// A strip with two vertices per unit of track: "a" and "b" give each pair
function strip(frames, a, b, uvs) {
    const count = frames.length;
    const pos = new Float32Array(count * 2 * 3);
    frames.forEach((f, i) => {
        pos.set(a(f), i * 6);
        pos.set(b(f), i * 6 + 3);
    });
    const index = [];
    for (let i = 0; i < count - 1; i++) {
        const p = i * 2;
        index.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (uvs) geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(index);
    return geo;
}

const edgeOf = (f, side) => [
    f.x + f.rx * side * TRACK_HALF_WIDTH,
    f.y + f.ry * side * TRACK_HALF_WIDTH,
    f.z + f.rz * side * TRACK_HALF_WIDTH,
];
const raised = (p, f, h) => [p[0] + f.ux * h, p[1] + f.uy * h, p[2] + f.uz * h];

export function buildChunk(track, s0, s1, style) {
    const mats = materialsFor(style);
    const frames = [];
    for (let s = s0; s <= s1; s++) frames.push(track.frameAt(s));

    const group = new THREE.Group();

    const uvs = new Float32Array(frames.length * 4);
    frames.forEach((f, i) => uvs.set([0, f.s / STRIPE_LENGTH, 1, f.s / STRIPE_LENGTH], i * 4));
    const ribbon = new THREE.Mesh(strip(frames, f => edgeOf(f, -1), f => edgeOf(f, 1), uvs), mats.road);
    ribbon.name = 'ribbon';
    group.add(ribbon);

    // Bright bands just inside the walls, so the glass road's edges read clearly
    if (mats.edge) {
        const inner = TRACK_HALF_WIDTH - EDGE_BAND;
        const at = (f, d) => [f.x + f.rx * d, f.y + f.ry * d + 0.005 * f.uy, f.z + f.rz * d];
        for (const [name, side] of [['edge-left', -1], ['edge-right', 1]]) {
            const band = new THREE.Mesh(strip(frames, f => at(f, side * inner), f => at(f, side * TRACK_HALF_WIDTH)), mats.edge);
            band.name = name;
            group.add(band);
        }
    }

    for (const [name, side] of [['wall-left', -1], ['wall-right', 1]]) {
        const wall = new THREE.Mesh(strip(frames, f => edgeOf(f, side), f => raised(edgeOf(f, side), f, WALL_HEIGHT)), mats.wall);
        wall.name = name;
        group.add(wall);

        const top = new Float32Array(frames.length * 3);
        frames.forEach((f, i) => top.set(raised(edgeOf(f, side), f, WALL_HEIGHT), i * 3));
        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.BufferAttribute(top, 3));
        const edge = new THREE.Line(edgeGeo, mats.wallEdge);
        edge.name = `${name}-edge`;
        group.add(edge);
    }
    return group;
}

function disposeChunk(chunk) {
    chunk.traverse(obj => obj.geometry && obj.geometry.dispose());
}

export function createTrackView(track, scene, style) {
    const chunks = new Map(); // chunk index -> group

    function update(sRider) {
        const kMin = Math.max(0, Math.floor((sRider - KEEP_BEHIND) / CHUNK_LENGTH));
        const kMax = Math.floor((sRider + KEEP_AHEAD) / CHUNK_LENGTH);
        for (const [k, chunk] of chunks) {
            if (k < kMin || k > kMax) {
                scene.remove(chunk);
                disposeChunk(chunk);
                chunks.delete(k);
            }
        }
        for (let k = kMin; k <= kMax; k++) {
            if (!chunks.has(k)) {
                const chunk = buildChunk(track, k * CHUNK_LENGTH, (k + 1) * CHUNK_LENGTH, style);
                scene.add(chunk);
                chunks.set(k, chunk);
            }
        }
    }

    function dispose() {
        for (const chunk of chunks.values()) {
            scene.remove(chunk);
            disposeChunk(chunk);
        }
        chunks.clear();
    }

    return { update, dispose };
}
