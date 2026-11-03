// Star Catcher 3D: ride the sky track, dodge obstacles, catch stars
import * as THREE from 'three';
import { createTrack } from './track.js';
import { RIDER_LIMIT, MAX_DT, steer, advanceRide, wallBounceStep } from './riding.js';
import { createScoring, STAR_POINTS, HEART_POINTS, NEAR_MISS_POINTS } from './scoring.js';
import { createTrackView, PURPLE_STYLE, RAINBOW_STYLE } from './trackMesh.js';
import { createPlacer, EASY, FREE_RIDE } from './placement.js';
import { sweptCheck, planetX } from './collision.js';
import { createLives } from './lives.js';
import {
    starGeo, starMat, heartGeo, heartMat, glowTex, makeGlow, createBoard, createWand, obstacleModel, rand, pick
} from './models.js';
import { createSky } from './sky.js';

// Tuning
const START_SPEED = 7;          // gentle ride behind the menu
const BASE_SPEED = 11;
const MAX_SPEED = 22;
const SPEED_GROWTH = 0.15;      // speed gained per second of riding
const STEER_SPEED = 8;          // keyboard steering, units per second
const DRAG_RANGE = 12;          // track units for a drag across the whole screen
const CAM_BACK = 2.2;           // camera distance behind the rider
const CAM_UP = 1.5;             // camera height above the board
const LOOK_AHEAD = 10;          // the camera looks at the track this far ahead
const CREST_FLOAT = 0.35;       // how high the board floats over a hilltop
const PLACE_AHEAD = 150;        // things are placed this far ahead along the track
const ITEM_Y = 0.9;             // height of stars and hearts above the track
const CLOUD_Y = 1.4;            // storm clouds float at about head height
const PLANET_Y = 0.5;
const HITBOX = 0.9;             // hitboxes are a little smaller than the models, to be kind
const TRACK_STYLE = PURPLE_STYLE;

const clamp = THREE.MathUtils.clamp;
const container = document.getElementById('game');

let renderer;
try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
} catch (e) {
    container.innerHTML = '<div id="error"><p>Sorry, this game needs 3D graphics (WebGL), which this browser does not support.</p></div>';
    throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x150a2e);
scene.fog = new THREE.Fog(0x150a2e, 70, 150); // hides track being built in the distance

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 600);
scene.add(camera); // so the wand (a child of the camera) is drawn

scene.add(new THREE.HemisphereLight(0xffe8ff, 0x4a2a7a, 1.3));
const moonLight = new THREE.DirectionalLight(0xfff0dd, 1.8);
moonLight.position.set(-5, 10, 4);
scene.add(moonLight);

const sky = createSky(scene);

// The rider: a group placed on the track, with a pivot inside for leaning
const rider = new THREE.Group();
scene.add(rider);
const leanPivot = new THREE.Group();
rider.add(leanPivot);
leanPivot.add(createBoard());

const wand = createWand();
camera.add(wand.group);
let wandPulse = 0;

function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Portrait phones need a wider view to see obstacles coming
    camera.fov = w < h ? 90 : 70;
    camera.updateProjectionMatrix();
    // Keep the wand on screen, even on narrow phones
    const depth = 1.0;
    const halfW = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * depth * camera.aspect;
    wand.group.position.set(Math.min(0.5, halfW * 0.7), -0.42, -depth);
}
window.addEventListener('resize', resize);
resize();

// Placing things on the track
const _basis = new THREE.Matrix4();
const _r = new THREE.Vector3();
const _u = new THREE.Vector3();
const _b = new THREE.Vector3();

function trackPoint(out, f, x, h) {
    return out.set(f.x + f.rx * x + f.ux * h, f.y + f.ry * x + f.uy * h, f.z + f.rz * x + f.uz * h);
}

// Turn an object to match the track: its -z along the track, +y along the track's up
function orient(obj, f) {
    _r.set(f.rx, f.ry, f.rz);
    _u.set(f.ux, f.uy, f.uz);
    _b.set(-f.fx, -f.fy, -f.fz);
    _basis.makeBasis(_r, _u, _b);
    obj.quaternion.setFromRotationMatrix(_basis);
}

// Rainbow sparkles trailing off the board, left behind in the world
const TRAIL_COUNT = 80;
const trailPos = new Float32Array(TRAIL_COUNT * 3).fill(-1e5);
const trailCol = new Float32Array(TRAIL_COUNT * 3);
const trailVel = Array.from({ length: TRAIL_COUNT }, () => new THREE.Vector3());
const trailLife = new Float32Array(TRAIL_COUNT);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
const trailPoints = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    size: 0.14, vertexColors: true, map: glowTex, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending
}));
trailPoints.frustumCulled = false;
scene.add(trailPoints);
const rainbowColors = RAINBOW_STYLE.colors.map(c => new THREE.Color(c));
let trailNext = 0;
const _emit = new THREE.Vector3();

function updateTrail(dt, emitting) {
    if (emitting) {
        for (let n = 0; n < 2; n++) {
            const i = trailNext;
            trailNext = (trailNext + 1) % TRAIL_COUNT;
            const side = Math.random() < 0.5 ? -1 : 1;
            rider.localToWorld(_emit.set(side * 0.4, 0.15, rand(-1.4, 0.4)));
            trailPos.set([_emit.x, _emit.y, _emit.z], i * 3);
            trailVel[i].set(rand(-0.5, 0.5), rand(0.4, 1.2), rand(-0.5, 0.5));
            const c = pick(rainbowColors);
            trailCol.set([c.r, c.g, c.b], i * 3);
            trailLife[i] = 0.5;
        }
    }
    for (let i = 0; i < TRAIL_COUNT; i++) {
        if (trailLife[i] <= 0) continue;
        trailLife[i] -= dt;
        trailPos[i * 3] += trailVel[i].x * dt;
        trailPos[i * 3 + 1] += trailVel[i].y * dt;
        trailPos[i * 3 + 2] += trailVel[i].z * dt;
        if (trailLife[i] <= 0) trailPos[i * 3 + 1] = -1e5;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
}

// Sparkle bursts for catches, bumps, near misses and wall touches
let bursts = [];
function burst(pos, color, size = 0.35) {
    const n = 18;
    const positions = new Float32Array(n * 3);
    const velocities = [];
    for (let i = 0; i < n; i++) {
        positions.set([pos.x, pos.y, pos.z], i * 3);
        velocities.push(new THREE.Vector3(rand(-3, 3), rand(0, 4), rand(-3, 3)));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
        color, size, map: glowTex, transparent: true,
        depthWrite: false, blending: THREE.AdditiveBlending
    }));
    scene.add(points);
    bursts.push({ points, velocities, life: 0.7 });
}

function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.life -= dt;
        const attr = b.points.geometry.attributes.position;
        b.velocities.forEach((v, j) => {
            attr.array[j * 3] += v.x * dt;
            attr.array[j * 3 + 1] += v.y * dt;
            attr.array[j * 3 + 2] += v.z * dt;
        });
        attr.needsUpdate = true;
        b.points.material.opacity = Math.max(0, b.life / 0.7);
        if (b.life <= 0) {
            scene.remove(b.points);
            b.points.geometry.dispose();
            b.points.material.dispose();
            bursts.splice(i, 1);
        }
    }
}

// Audio setup (Web Audio API for zero external file dependencies)
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'star') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'heart') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(554.37, now + 0.08);
            osc.frequency.setValueAtTime(659.25, now + 0.16);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'hurt') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.25);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'whoosh') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'boing') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.18);
        }
    } catch (e) {
        // Ignore audio context autoplay blocks before interaction
    }
}

// Leaderboard Management
const LB_KEY = 'star_catcher_3d_leaderboard';

function getLeaderboard() {
    try {
        const data = localStorage.getItem(LB_KEY);
        if (data) return JSON.parse(data);
    } catch (e) {}
    return [];
}

function saveLeaderboard(lb) {
    try {
        localStorage.setItem(LB_KEY, JSON.stringify(lb));
    } catch (e) {}
}

function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderLeaderboard(elementId) {
    const listEl = document.getElementById(elementId);
    const lb = getLeaderboard();
    listEl.innerHTML = '';
    if (lb.length === 0) {
        const li = document.createElement('li');
        li.className = 'lb-item';
        li.innerHTML = '<span class="lb-name" style="text-align: center;">No scores yet. Be the first! ⭐</span>';
        listEl.appendChild(li);
        return;
    }
    lb.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'lb-item';
        li.innerHTML = `
            <span class="lb-rank">#${index + 1}</span>
            <span class="lb-name">${escapeHtml(entry.name)}</span>
            <span class="lb-score">${entry.score.toLocaleString()}</span>
        `;
        listEl.appendChild(li);
    });
}

// Game state
let gameState = 'START'; // START, PLAYING, GAMEOVER
let freeRide = false;
let track = null;
let trackView = null;
let placer = null;
let ride = { s: 0, speed: 0 };
let x = 0;
let targetX = 0;
let lean = 0;
let wall = { bounce: 0, touching: false, cooldown: 0, lean: 0 };
let elapsed = 0;
let time = 0;
let shake = 0;
let scoring = createScoring();
let lives = createLives();
let shownScore = -1;
let items = [];

function clearItems() {
    items.forEach(it => scene.remove(it.obj));
    items = [];
}

function newTrack(mode) {
    if (trackView) trackView.dispose();
    clearItems();
    const seed = Math.floor(Math.random() * 1e9);
    track = createTrack({ seed, difficulty: () => Math.min(1, elapsed / 120) });
    trackView = createTrackView(track, scene, TRACK_STYLE);
    placer = createPlacer({ seed, track, mode });
    ride = { s: 0, speed: ride.speed };
    x = 0;
    targetX = 0;
}

// Turn a placement into something you can see on the track
function spawn(p) {
    let obj;
    let radius = p.radius;
    let height = 0;
    if (p.type === 'star' || p.type === 'heart') {
        obj = new THREE.Group();
        const spinner = new THREE.Group();
        spinner.add(new THREE.Mesh(p.type === 'star' ? starGeo : heartGeo, p.type === 'star' ? starMat : heartMat));
        spinner.add(makeGlow(p.type === 'star' ? 0xffd700 : 0xff5599, p.type === 'star' ? 1.8 : 2, 0.55));
        obj.add(spinner);
        obj.userData.model = spinner;
        height = ITEM_Y;
    } else {
        const model = obstacleModel(p.kind);
        obj = model.object;
        radius = model.radius * HITBOX;
        height = p.kind === 'stormCloud' ? CLOUD_Y : p.kind === 'planet' ? PLANET_Y : 0;
        if (!obj.userData.faceRider && p.kind !== 'planet') obj.userData.model.rotation.y = rand(0, Math.PI * 2);
    }
    scene.add(obj);
    items.push({ p, obj, radius, height, x: p.x, phase: rand(0, Math.PI * 2), done: false, near: false });
}

function updateHud() {
    shownScore = scoring.score;
    document.getElementById('score-display').innerText = scoring.score.toLocaleString();
    document.getElementById('lives-display').innerText = '❤️'.repeat(Math.max(0, lives.lives));
    const mult = scoring.multiplier();
    document.getElementById('combo-display').innerText = mult;
    document.getElementById('combo-pill').style.visibility = mult > 1 ? 'visible' : 'hidden';
}

function popCombo(multiplierUp) {
    if (!multiplierUp) return;
    const pill = document.getElementById('combo-pill');
    pill.classList.add('pop');
    setTimeout(() => pill.classList.remove('pop'), 200);
}

function flashHit() {
    const el = document.getElementById('hit-flash');
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.6s';
        el.style.opacity = '0';
    });
}

function showScreen(id) {
    for (const screen of ['start-screen', 'game-over-screen']) {
        document.getElementById(screen).classList.toggle('hidden', screen !== id);
    }
}

function startGame(free = false) {
    initAudio();
    freeRide = free;
    elapsed = 0;
    shake = 0;
    scoring = createScoring();
    lives = createLives();
    newTrack(free ? FREE_RIDE : EASY);
    ride.speed = BASE_SPEED;

    showScreen(null);
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('hud').classList.toggle('free-ride', free);
    updateHud();
    gameState = 'PLAYING';
}

function goToMenu() {
    if (gameState !== 'PLAYING' || !freeRide) return;
    gameState = 'START';
    freeRide = false;
    newTrack(FREE_RIDE);
    document.getElementById('hud').classList.add('hidden');
    showScreen('start-screen');
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    leanPivot.visible = true;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('final-score').innerText = scoring.score.toLocaleString();
    document.getElementById('best-combo').innerText = 'x' + scoring.bestMultiplier;

    const lb = getLeaderboard();
    const lowestScore = lb.length < 5 ? 0 : lb[lb.length - 1].score;
    const hsSection = document.getElementById('new-high-score-section');
    if (scoring.score > 0 && (scoring.score > lowestScore || lb.length < 5)) {
        hsSection.classList.remove('hidden');
        document.getElementById('player-name').value = '';
    } else {
        hsSection.classList.add('hidden');
    }

    renderLeaderboard('gameover-lb');
    showScreen('game-over-screen');
}

const _p = new THREE.Vector3();

// What happens when the board reaches something
function touch(it, result) {
    const { p } = it;
    if (p.type === 'star' || p.type === 'heart') {
        if (result !== 'hit') return;
        it.done = true;
        popCombo(scoring.addCatch(p.type === 'star' ? STAR_POINTS : HEART_POINTS).multiplierUp);
        if (p.type === 'heart') lives.heal();
        playSound(p.type);
        burst(it.obj.position, p.type === 'star' ? 0xffee55 : 0xff5599);
        wandPulse = 0.4;
        scene.remove(it.obj);
        updateHud();
        return;
    }
    if (result === 'near') {
        it.near = true;
        return;
    }
    // A bump: costs a life unless the board is still blinking from the last one
    it.done = true;
    const { lost, gameOver } = lives.hit();
    if (!lost) return;
    scoring.bump();
    shake = 0.3;
    playSound('hurt');
    flashHit();
    burst(rider.position, 0xc9b8ff);
    updateHud();
    if (gameOver) triggerGameOver();
}

function updateItems(dt, prevS) {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        const { p } = it;
        if (p.s < ride.s - 5 || (it.done && !it.obj.parent)) {
            scene.remove(it.obj);
            items.splice(i, 1);
            continue;
        }

        if (p.type === 'planet') it.x = planetX(p.range, elapsed + it.phase);
        const f = track.frameAt(p.s);
        const bob = p.kind === 'stormCloud' ? Math.sin(time * 2 + it.phase) * 0.12 : 0;
        trackPoint(it.obj.position, f, it.x, it.height + bob);
        orient(it.obj, f);
        if (p.type === 'star' || p.type === 'heart') {
            it.obj.userData.model.rotation.y += dt * 2.5;
            it.obj.position.addScaledVector(_u.set(f.ux, f.uy, f.uz), Math.sin(time * 3 + it.phase) * 0.08);
        } else if (p.type === 'planet') {
            it.obj.userData.model.rotation.z = -it.x * 2; // rolls as it moves
        }
        // Shrink away once passed so nothing blocks the camera
        if (p.s < ride.s - 0.5) it.obj.scale.setScalar(Math.max(0.001, 1 - (ride.s - 0.5 - p.s) / 1.5));

        if (gameState !== 'PLAYING' || freeRide || it.done) continue;
        const result = sweptCheck({ s: p.s, x: it.x, radius: it.radius }, prevS, ride.s, x);
        if (result) touch(it, result);

        // A near miss counts once the obstacle is safely behind
        if (it.near && !it.done && p.s <= ride.s - 0.6) {
            it.done = true;
            popCombo(scoring.addCatch(NEAR_MISS_POINTS).multiplierUp);
            playSound('whoosh');
            burst(it.obj.position, 0xffffff, 0.25);
            updateHud();
        }
    }
}

// Input
const keys = { left: false, right: false };
let dragPointer = null;
let lastPointerX = 0;

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = true;
    if (e.key === 'Escape') goToMenu();
    if (e.key.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
});
// Switching windows can swallow a key-up, so let go of everything
window.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
});

// Dragging moves the board by how far the finger moves; only the first finger steers
canvas.addEventListener('pointerdown', (e) => {
    if (gameState !== 'PLAYING' || dragPointer !== null) return;
    dragPointer = e.pointerId;
    lastPointerX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
    if (gameState !== 'PLAYING' || e.pointerId !== dragPointer) return;
    const dx = e.clientX - lastPointerX;
    lastPointerX = e.clientX;
    targetX = clamp(targetX + (dx / canvas.clientWidth) * DRAG_RANGE, -RIDER_LIMIT - 0.5, RIDER_LIMIT + 0.5);
});
const endDrag = (e) => { if (e.pointerId === dragPointer) dragPointer = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// Main loop
const clock = new THREE.Clock();
const _camPos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

function frame() {
    const dt = Math.min(clock.getDelta(), MAX_DT);
    if (dt <= 0) return;
    time += dt;

    let base = 0;
    if (gameState === 'PLAYING') {
        elapsed += dt;
        base = Math.min(MAX_SPEED, BASE_SPEED + elapsed * SPEED_GROWTH);
    } else if (gameState === 'START') {
        base = START_SPEED;
    }

    // Move along the track
    const prevS = ride.s;
    ride = advanceRide(ride, base, track.frameAt(ride.s).slope, dt);
    track.pruneBefore(ride.s - 60);
    trackView.update(ride.s);
    placer.fill(ride.s + PLACE_AHEAD, elapsed).forEach(spawn);
    if (gameState === 'PLAYING' && !freeRide) {
        scoring.addDistance(ride.s - prevS);
        lives.tick(dt);
        if (scoring.score !== shownScore) updateHud();
    }

    // Steering
    if (gameState === 'PLAYING') {
        const keyDir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        targetX = clamp(targetX + keyDir * STEER_SPEED * dt, -RIDER_LIMIT - 0.5, RIDER_LIMIT + 0.5);
    } else if (gameState === 'START') {
        targetX = Math.sin(time * 0.5) * 3; // gentle carving behind the menu
    }
    const steered = steer(x, targetX, dt);
    const vx = (steered.x - x) / dt;
    x = steered.x;

    // Touching the magic wall: a sparkle, a boing and a little bounce, but no harm
    wall = wallBounceStep(wall, steered.wallTouch && gameState === 'PLAYING', dt);
    if (wall.triggered) {
        playSound('boing');
        const wf = track.frameAt(ride.s + 1);
        burst(trackPoint(_p, wf, Math.sign(x) * 6, 0.5), 0xff99ff);
    }

    // Place the rider on the track, floating up a little over hilltops
    const f = track.frameAt(ride.s);
    trackPoint(rider.position, f, x, track.crestLift(ride.s) * CREST_FLOAT);
    orient(rider, f);
    lean += (clamp(-vx * 0.05, -0.4, 0.4) - lean) * Math.min(1, dt * 8);
    leanPivot.rotation.z = lean + Math.sign(x) * wall.lean;
    leanPivot.position.y = Math.sin(time * 4) * 0.02;
    // Blink while safe after a bump
    leanPivot.visible = gameState === 'PLAYING' && lives.isSafe() ? Math.floor(time * 12) % 2 === 0 : true;

    updateItems(dt, prevS);
    updateTrail(dt, ride.speed > 1);
    updateBursts(dt);

    // Camera: just behind and above the board, rolling half as much as the track
    _camPos.copy(rider.position)
        .addScaledVector(_b.set(f.fx, f.fy, f.fz), -CAM_BACK)
        .addScaledVector(_u.set(f.ux, f.uy, f.uz), CAM_UP);
    camera.position.copy(_camPos);
    if (shake > 0) {
        shake -= dt;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
    }
    const ahead = track.frameAt(ride.s + LOOK_AHEAD);
    trackPoint(_look, ahead, x * 0.6, 0.6);
    camera.up.copy(_u).add(_worldUp).normalize();
    camera.lookAt(_look);

    sky.update(dt, rider.position);

    // Wand bobs along and glows when you catch something
    wand.group.position.y = -0.42 + Math.sin(time * 3) * 0.01;
    if (wandPulse > 0) wandPulse -= dt;
    wand.glow.scale.setScalar(0.35 + Math.max(0, wandPulse) * 1.5);

    renderer.render(scene, camera);
}

// UI buttons
document.getElementById('start-btn').addEventListener('click', () => startGame(false));
document.getElementById('free-btn').addEventListener('click', () => startGame(true));
document.getElementById('restart-btn').addEventListener('click', () => startGame(false));
document.getElementById('menu-btn').addEventListener('click', goToMenu);

document.getElementById('save-score-btn').addEventListener('click', () => {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim() || 'Fairy Rider';

    let lb = getLeaderboard();
    lb.push({ name, score: scoring.score });
    lb.sort((a, b) => b.score - a.score);
    lb = lb.slice(0, 5);

    saveLeaderboard(lb);
    document.getElementById('new-high-score-section').classList.add('hidden');
    renderLeaderboard('gameover-lb');
    renderLeaderboard('start-lb');
});

newTrack(FREE_RIDE);
renderLeaderboard('start-lb');
renderer.setAnimationLoop(frame);
