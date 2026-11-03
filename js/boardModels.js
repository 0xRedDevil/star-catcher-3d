// The four boards. Each unlocked board has something moving, and each tier is more
// spectacular than the last. Boards point their nose down -z with their top facing +y.
import * as THREE from 'three';
import { makeGlow, starGeo, starMat, glowTex } from './models.js';

const SHARED = new Set([starGeo, starMat, glowTex]); // used by other things too, so never freed here

export const BOARD_W = 0.8;
export const BOARD_L = 2.2;
const BOARD_Z = -0.4;      // the board sits a little ahead of the rider's position
const BOARD_Y = 0.18;

function roundedRect(w, l, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -l / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + l - r);
    s.quadraticCurveTo(x + w, y + l, x + w - r, y + l);
    s.lineTo(x + r, y + l);
    s.quadraticCurveTo(x, y + l, x, y + l - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
}

function drawStar(g, cx, cy, outer, inner) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
}

// A board surface texture; returns null in Node, where there is no canvas
function surface(draw) {
    if (typeof document === 'undefined' || !document.createElement('canvas').getContext) return null;
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 256;
    const g = c.getContext('2d');
    draw(g, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // Map the board's shape coordinates onto the texture
    tex.repeat.set(1 / BOARD_W, 1 / BOARD_L);
    tex.offset.set(0.5, 0.5);
    return tex;
}

const LOOKS = {
    starter: {
        trailColors: [0xd9c4ff],
        trailRate: 1,
        runner: 0xf0e6ff,
        aura: { color: 0xffffff, opacity: 0.3 },
        texture: (g, w, h) => {
            g.fillStyle = '#c9b3ff';
            g.fillRect(0, 0, w, h);
            g.fillStyle = 'rgba(255, 255, 255, 0.9)';
            drawStar(g, w / 2, h * 0.4, 26, 11);
        },
    },
    candy: {
        trailColors: [0xff7ac8, 0xffffff, 0x9ff0d6],
        trailRate: 2,
        runner: 0xffb3e0,
        aura: { color: 0xff7ac8, opacity: 0.5, pulse: 0.25 },
        scroll: 0.35,
        texture: (g, w, h) => {
            // Diagonal pink and mint candy stripes with sugar sparkles
            for (let i = -h; i < w + h; i += 32) {
                g.fillStyle = (i / 32) % 2 === 0 ? '#ff7ac8' : '#9ff0d6';
                g.beginPath();
                g.moveTo(i, 0);
                g.lineTo(i + 32, 0);
                g.lineTo(i + 32 - h, h);
                g.lineTo(i - h, h);
                g.closePath();
                g.fill();
            }
            g.fillStyle = 'rgba(255, 255, 255, 0.85)';
            for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
        },
    },
    galaxy: {
        trailColors: [0x4f7bff, 0xffffff, 0x7fe8ff],
        trailRate: 3,
        runner: 0x7fe8ff,
        aura: { color: 0x4fd8ff, opacity: 0.45, pulse: 0.2 },
        edge: 0x7fe8ff,
        scroll: 0.12,
        twinkle: true,
        texture: (g, w, h) => {
            const grad = g.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#0a1a4a');
            grad.addColorStop(0.5, '#2a1060');
            grad.addColorStop(1, '#0a1a4a');
            g.fillStyle = grad;
            g.fillRect(0, 0, w, h);
            for (let i = 0; i < 70; i++) {
                g.fillStyle = Math.random() < 0.3 ? '#9fe8ff' : '#ffffff';
                const size = Math.random() < 0.15 ? 3 : 2;
                g.fillRect(Math.random() * w, Math.random() * h, size, size);
            }
            g.fillStyle = 'rgba(255, 255, 255, 0.9)';
            drawStar(g, w / 2, h * 0.4, 18, 7);
        },
    },
    rainbow: {
        trailColors: [0xff4d6d, 0xff9f43, 0xffe66d, 0x4ade80, 0x38bdf8, 0xa78bfa],
        trailRate: 5,
        runner: 0xffffff,
        aura: { color: 0xffffff, opacity: 0.55, pulse: 0.35 },
        edge: 0xffffff,
        scroll: 0.6,
        orbit: true,
        texture: (g, w, h) => {
            // Rainbow bands running across the board, so they slide along it as it scrolls
            const colors = ['#ff4d6d', '#ff9f43', '#ffe66d', '#4ade80', '#38bdf8', '#a78bfa'];
            const band = h / colors.length;
            colors.forEach((col, i) => {
                g.fillStyle = col;
                g.fillRect(0, i * band, w, band + 1);
            });
            g.fillStyle = 'rgba(255, 255, 255, 0.5)';
            for (let i = 1; i < 4; i++) g.fillRect((w / 4) * i - 2, 0, 4, h);
            g.fillStyle = 'rgba(255, 255, 255, 0.9)';
            for (let i = 0; i < 30; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
        },
    },
};

export function createBoardModel(id) {
    const look = LOOKS[id] || LOOKS.starter;
    const group = new THREE.Group();

    const boardGeo = new THREE.ExtrudeGeometry(roundedRect(BOARD_W, BOARD_L, 0.32), {
        depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8
    });
    boardGeo.rotateX(-Math.PI / 2);
    const map = surface(look.texture);
    const bodyMat = new THREE.MeshBasicMaterial({ map, color: map ? 0xffffff : look.trailColors[0] });
    const body = new THREE.Mesh(boardGeo, bodyMat);
    body.position.set(0, BOARD_Y, BOARD_Z);
    group.add(body);

    // Glowing runners underneath and a golden handle loop at the front
    const runnerGeo = new THREE.CylinderGeometry(0.035, 0.035, BOARD_L * 0.9, 6);
    runnerGeo.rotateX(Math.PI / 2);
    const runnerMat = new THREE.MeshBasicMaterial({ color: look.runner });
    for (const side of [-1, 1]) {
        const runner = new THREE.Mesh(runnerGeo, runnerMat);
        runner.position.set(side * (BOARD_W / 2 - 0.08), 0.12, BOARD_Z);
        group.add(runner);
    }
    const handle = new THREE.Mesh(
        new THREE.TorusGeometry(BOARD_W * 0.38, 0.035, 6, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x996600, metalness: 0.5, roughness: 0.3 })
    );
    handle.position.set(0, 0.26, BOARD_Z - BOARD_L / 2 + 0.25);
    group.add(handle);

    const aura = makeGlow(look.aura.color, 2.6, look.aura.opacity);
    aura.position.set(0, 0.08, BOARD_Z);
    group.add(aura);

    // A glowing outline just under the board's edge
    let edge = null;
    if (look.edge) {
        edge = new THREE.Mesh(
            new THREE.ShapeGeometry(roundedRect(BOARD_W + 0.14, BOARD_L + 0.14, 0.38)),
            new THREE.MeshBasicMaterial({
                color: look.edge, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending,
                depthWrite: false, side: THREE.DoubleSide
            })
        );
        edge.rotation.x = -Math.PI / 2;
        edge.position.set(0, BOARD_Y - 0.01, BOARD_Z);
        group.add(edge);
    }

    // Little gold stars circling the top board
    const orbiters = [];
    if (look.orbit) {
        for (let i = 0; i < 3; i++) {
            const star = new THREE.Group();
            star.name = 'orbit-star';
            const mesh = new THREE.Mesh(starGeo, starMat);
            mesh.scale.setScalar(0.24);
            star.add(mesh);
            star.add(makeGlow(0xffe066, 0.6, 0.8));
            group.add(star);
            orbiters.push(star);
        }
    }

    function update(dt, time) {
        if (map && look.scroll) map.offset.y = 0.5 + ((time * look.scroll) % 1);
        if (look.twinkle) bodyMat.color.setScalar(0.85 + 0.15 * Math.sin(time * 6));
        if (look.aura.pulse) {
            const pulse = 1 + look.aura.pulse * Math.sin(time * 4);
            aura.scale.setScalar(2.6 * pulse);
            aura.material.opacity = look.aura.opacity * pulse;
        }
        if (edge) edge.material.opacity = 0.45 + 0.25 * Math.sin(time * 5);
        orbiters.forEach((star, i) => {
            const a = time * 2.2 + (i * Math.PI * 2) / orbiters.length;
            star.position.set(Math.cos(a) * 0.9, 0.45 + Math.sin(time * 3 + i) * 0.12, BOARD_Z + Math.sin(a) * 1.2);
            star.rotation.y = time * 4;
        });
    }
    update(0, 0);

    // Free this board's graphics memory when it's swapped for another
    function dispose() {
        const freed = new Set();
        const free = (thing) => {
            if (thing && !SHARED.has(thing) && !freed.has(thing)) {
                freed.add(thing);
                thing.dispose();
            }
        };
        group.traverse(obj => {
            free(obj.geometry);
            if (obj.material) {
                free(obj.material.map);
                free(obj.material);
            }
        });
    }

    return {
        group,
        update,
        dispose,
        trailColors: look.trailColors.map(c => new THREE.Color(c)),
        trailRate: look.trailRate,
        auraColor: look.aura.color,
    };
}
