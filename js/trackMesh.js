// Turns the track's frames into the rainbow road and its see-through walls, a chunk at a time
import * as THREE from 'three';
import { TRACK_HALF_WIDTH } from './track.js';

export const CHUNK_LENGTH = 50;
export const WALL_HEIGHT = 0.8;
const KEEP_BEHIND = 20;
const KEEP_AHEAD = 150;
const STRIPE_LENGTH = 8;   // track units per repeat of the road texture

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
        const map = makeRoadTexture(style.colors);
        style._materials = {
            road: new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : style.colors[0], side: THREE.DoubleSide }),
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
