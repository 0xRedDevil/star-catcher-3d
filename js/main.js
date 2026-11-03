// Star Catcher 3D: ride the sky track, dodge obstacles, catch stars
import * as THREE from 'three';
import { createTrack } from './track.js';
import { RIDER_LIMIT, MAX_DT, steer, advanceRide, wallBounceStep } from './riding.js';
import { createScoring, STAR_POINTS, HEART_POINTS, NEAR_MISS_POINTS } from './scoring.js';
import { createTrackView, ZONE_STYLES } from './trackMesh.js';
import { createPlacer, FREE_RIDE, PLACE_AHEAD } from './placement.js';
import { useDistanceFog, FOG_NEAR, FOG_FAR } from './fog.js';
import { sweptCheck, planetX } from './collision.js';
import { createLives } from './lives.js';
import { createStore } from './storage.js';
import { MODES, speedAt } from './modes.js';
import { zoneAt } from './zones.js';
import { BOARDS, unlocksFor } from './boards.js';
import {
    starGeo, starMat, heartGeo, heartMat, glowTex, makeGlow, obstacleModel, rand, pick
} from './models.js';
import { createBoardModel } from './boardModels.js';
import { createSky } from './sky.js';

// Tuning
const START_SPEED = 7;          // gentle ride behind the menu
const STEER_SPEED = 8;          // keyboard steering, units per second
const DRAG_RANGE = 12;          // track units for a drag across the whole screen
const CAM_BACK = 2.2;           // camera distance behind the rider
const CAM_UP = 1.5;             // camera height above the board
const LOOK_AHEAD = 10;          // the camera looks at the track this far ahead
const CREST_FLOAT = 0.35;       // how high the board floats over a hilltop
const ITEM_Y = 0.9;             // height of stars and hearts above the track
const CLOUD_Y = 1.4;            // storm clouds float at about head height
const CLOUD_SPEED = 1.2;        // how fast storm clouds drift sideways
const PLANET_Y = 0.5;
const HITBOX = 0.9;             // hitboxes are a little smaller than the models, to be kind
const BANNER_TIME = 2200;       // ms each banner stays up

const clamp = THREE.MathUtils.clamp;
const $ = (id) => document.getElementById(id);
const container = $('game');
const store = createStore();

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
useDistanceFog(THREE); // must run before anything is first drawn
scene.fog = new THREE.Fog(0x150a2e, FOG_NEAR, FOG_FAR); // hides track being built in the distance
const skyTarget = new THREE.Color(0x150a2e);

const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 600);

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
let boardModel = null;

function useBoard(id) {
    if (boardModel) leanPivot.remove(boardModel.group);
    boardModel = createBoardModel(id);
    leanPivot.add(boardModel.group);
}
useBoard(store.board());


function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // Portrait phones need a wider view to see obstacles coming
    camera.fov = w < h ? 90 : 70;
    camera.updateProjectionMatrix();
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

// Sparkles trailing off the board, in the board's own colours, left behind in the world
const TRAIL_COUNT = 160;
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
let trailNext = 0;
const _emit = new THREE.Vector3();

function updateTrail(dt, emitting) {
    if (emitting) {
        for (let n = 0; n < boardModel.trailRate; n++) {
            const i = trailNext;
            trailNext = (trailNext + 1) % TRAIL_COUNT;
            const side = Math.random() < 0.5 ? -1 : 1;
            rider.localToWorld(_emit.set(side * 0.4, 0.15, rand(-1.4, 0.4)));
            trailPos.set([_emit.x, _emit.y, _emit.z], i * 3);
            trailVel[i].set(rand(-0.5, 0.5), rand(0.4, 1.2), rand(-0.5, 0.5));
            const c = pick(boardModel.trailColors);
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

// Sparkle bursts for catches, bumps, near misses, wall touches and celebrations
let bursts = [];
function burst(pos, color, size = 0.35, count = 18, speed = 3) {
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
        positions.set([pos.x, pos.y, pos.z], i * 3);
        velocities.push(new THREE.Vector3(rand(-speed, speed), rand(0, speed * 1.3), rand(-speed, speed)));
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

// A big sparkly celebration around the board, in its own colours
function celebrate() {
    boardModel.trailColors.forEach((c, i) => {
        setTimeout(() => burst(rider.position, c.getHex(), 0.45, 30, 4), i * 120);
    });
}

// Audio setup (Web Audio API for zero external file dependencies)
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(type, from, to, length, volume, at = 0) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime + at;
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, now + length);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + length);
    osc.start(now);
    osc.stop(now + length);
}

function playSound(type) {
    if (!audioCtx) return;
    try {
        if (type === 'star') tone('sine', 587.33, 880, 0.15, 0.2);
        else if (type === 'heart') {
            tone('triangle', 440, 440, 0.08, 0.2);
            tone('triangle', 554.37, 554.37, 0.08, 0.2, 0.08);
            tone('triangle', 659.25, 659.25, 0.14, 0.2, 0.16);
        } else if (type === 'hurt') tone('sawtooth', 150, 60, 0.25, 0.3);
        else if (type === 'whoosh') tone('sine', 900, 300, 0.15, 0.12);
        else if (type === 'boing') tone('sine', 300, 180, 0.18, 0.15);
        else if (type === 'chime') {
            tone('sine', 880, 880, 0.12, 0.15);
            tone('sine', 1320, 1320, 0.2, 0.15, 0.12);
        } else if (type === 'fanfare') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.35 : 0.1, 0.2, i * 0.1));
        }
    } catch (e) {
        // Ignore audio context autoplay blocks before interaction
    }
}

// Banners and toasts, one at a time
const bannerQueue = [];
let bannerBusy = false;
let bannerTimer = null;
function showBanner(title, subtitle = '') {
    bannerQueue.push({ title, subtitle });
    if (!bannerBusy) nextBanner();
}
function nextBanner() {
    const next = bannerQueue.shift();
    const el = $('banner');
    if (!next) {
        bannerBusy = false;
        el.classList.remove('show');
        return;
    }
    bannerBusy = true;
    $('banner-title').innerText = next.title;
    $('banner-subtitle').innerText = next.subtitle;
    el.classList.add('show');
    bannerTimer = setTimeout(() => {
        el.classList.remove('show');
        bannerTimer = setTimeout(nextBanner, 300);
    }, BANNER_TIME);
}
// Stop everything, including the banner showing now, so nothing carries into the next screen
function clearBanners() {
    bannerQueue.length = 0;
    clearTimeout(bannerTimer);
    bannerBusy = false;
    $('banner').classList.remove('show');
}

let toastTimer = null;
function showToast(text) {
    const el = $('zone-toast');
    el.innerText = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// Leaderboards
function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderLeaderboard(elementId, modeId) {
    const listEl = $(elementId);
    const lb = store.leaderboard(modeId);
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
let modeId = store.lastMode();
let lbTab = modeId;
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
let previousBest = 0;
let newBestShown = false;
let unlockedThisRide = [];
let zoneIndex = 0;
let items = [];

function clearItems() {
    items.forEach(it => scene.remove(it.obj));
    items = [];
}

function enterZone(z, announce) {
    zoneIndex = z.index;
    skyTarget.set(z.zone.sky);
    sky.setNebula(z.zone.nebula);
    if (announce) {
        showToast(z.name);
        playSound('chime');
    }
}

function newTrack(placement) {
    if (trackView) trackView.dispose();
    clearItems();
    const seed = Math.floor(Math.random() * 1e9);
    track = createTrack({ seed, difficulty: () => Math.min(1, elapsed / 120) });
    trackView = createTrackView(track, scene, (s) => ZONE_STYLES[zoneAt(s).zone.id]);
    placer = createPlacer({ seed, track, mode: placement });
    ride = { s: 0, speed: ride.speed };
    x = 0;
    targetX = 0;
    enterZone(zoneAt(0), false);
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
        height = p.kind === 'floater' ? CLOUD_Y : p.kind === 'planet' ? PLANET_Y : 0;
        if (!obj.userData.faceRider && p.kind !== 'planet') obj.userData.model.rotation.y = rand(0, Math.PI * 2);
    }
    scene.add(obj);
    items.push({ p, obj, radius, height, x: p.x, phase: rand(0, Math.PI * 2), done: false, near: false });
}

function updateHud() {
    shownScore = scoring.score;
    $('score-display').innerText = scoring.score.toLocaleString();
    $('best-display').innerText = Math.max(previousBest, scoring.score).toLocaleString();
    $('lives-display').innerText = '❤️'.repeat(Math.max(0, lives.lives));
    const mult = scoring.multiplier();
    $('combo-display').innerText = mult;
    $('combo-pill').style.visibility = mult > 1 ? 'visible' : 'hidden';

    if (gameState !== 'PLAYING' || freeRide) return;
    // Passing your best, once per ride
    if (!newBestShown && previousBest > 0 && scoring.score > previousBest) {
        newBestShown = true;
        showBanner('NEW BEST! 🏆', `${MODES[modeId].label} mode`);
        playSound('fanfare');
        burst(rider.position, 0xffd700, 0.4, 30, 4);
    }
    // Unlocks are saved straight away, so they survive closing the tab
    for (const id of store.unlock(unlocksFor(scoring.score))) {
        const board = BOARDS.find(b => b.id === id);
        unlockedThisRide.push(board.name);
        showBanner('NEW BOARD UNLOCKED! ✨', board.name);
        playSound('fanfare');
        burst(rider.position, 0xff99ff, 0.45, 30, 4);
    }
}

function popCombo(multiplierUp) {
    if (!multiplierUp) return;
    const pill = $('combo-pill');
    pill.classList.add('pop');
    setTimeout(() => pill.classList.remove('pop'), 200);
}

function flashHit() {
    const el = $('hit-flash');
    el.style.transition = 'none';
    el.style.opacity = '1';
    requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.6s';
        el.style.opacity = '0';
    });
}

function showScreen(id) {
    for (const screen of ['start-screen', 'game-over-screen']) {
        $(screen).classList.toggle('hidden', screen !== id);
    }
}

// Start screen: mode buttons, board picker and the top 5 tabs
function renderStart() {
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.toggle('last', btn.dataset.mode === modeId));
    document.querySelectorAll('.lb-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === lbTab));
    renderLeaderboard('start-lb', lbTab);

    const picker = $('board-picker');
    picker.innerHTML = '';
    const unlocked = store.unlocked();
    for (const board of BOARDS) {
        const open = unlocked.includes(board.id);
        const card = document.createElement('button');
        card.className = `board-card board-${board.id}${open ? '' : ' locked'}${store.board() === board.id ? ' selected' : ''}`;
        card.innerHTML = `
            <span class="board-swatch"></span>
            <span class="board-name">${board.name}</span>
            <span class="board-lock">${open ? (store.board() === board.id ? '✓ Riding' : 'Tap to ride') : `🔒 Score ${board.unlockScore.toLocaleString()}`}</span>
        `;
        card.addEventListener('click', () => {
            if (!store.setBoard(board.id)) return;
            useBoard(board.id);
            renderStart();
        });
        picker.appendChild(card);
    }
}

function startGame(nextMode) {
    initAudio();
    clearBanners();
    freeRide = nextMode === 'free';
    if (!freeRide) {
        modeId = nextMode;
        store.setLastMode(modeId);
    }
    const mode = MODES[freeRide ? 'easy' : modeId];
    elapsed = 0;
    shake = 0;
    scoring = createScoring();
    lives = createLives({ start: mode.lives, max: mode.maxLives });
    previousBest = freeRide ? 0 : store.best(modeId);
    newBestShown = false;
    unlockedThisRide = [];
    newTrack(freeRide ? FREE_RIDE : mode.placement);
    ride.speed = speedAt(mode, 0);

    showScreen(null);
    $('hud').classList.remove('hidden');
    $('hud').classList.toggle('free-ride', freeRide);
    updateHud();
    gameState = 'PLAYING';

    // The first ride on a newly unlocked board gets a celebration
    const boardId = store.board();
    if (boardId !== 'starter' && !store.celebrated(boardId)) {
        store.markCelebrated(boardId);
        showBanner(`Riding the ${BOARDS.find(b => b.id === boardId).name}! 🎉`);
        playSound('fanfare');
        setTimeout(celebrate, 200);
    }
}

function goToMenu() {
    if (gameState === 'START') return;
    if (gameState === 'PLAYING' && !freeRide) return; // only Free Ride can leave mid-ride
    gameState = 'START';
    freeRide = false;
    clearBanners();
    newTrack(FREE_RIDE);
    $('hud').classList.add('hidden');
    lbTab = modeId;
    renderStart();
    showScreen('start-screen');
}

function triggerGameOver() {
    gameState = 'GAMEOVER';
    leanPivot.visible = true;
    clearBanners();
    store.recordBest(modeId, scoring.score);
    $('hud').classList.add('hidden');
    $('final-score').innerText = scoring.score.toLocaleString();
    $('best-combo').innerText = 'x' + scoring.bestMultiplier;
    $('zone-reached').innerText = zoneAt(ride.s).name;
    // Shown here too, in case the ride ended before the unlock banner had its turn
    $('gameover-unlocks').innerText = unlockedThisRide.length
        ? `✨ New board unlocked: ${unlockedThisRide.join(', ')}! Pick it on the menu.` : '';
    $('gameover-unlocks').classList.toggle('hidden', !unlockedThisRide.length);
    $('gameover-lb-title').innerText = `🏆 ${MODES[modeId].label} Top 5`;

    $('new-high-score-section').classList.toggle('hidden', !store.qualifies(modeId, scoring.score));
    $('player-name').value = '';

    renderLeaderboard('gameover-lb', modeId);
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

        // Rolling planets and storm clouds move back and forth across their own stretch
        if (p.range) it.x = planetX(p.range, elapsed + it.phase, p.kind === 'planet' ? 2 : CLOUD_SPEED);
        const f = track.frameAt(p.s);
        const bob = p.kind === 'floater' ? Math.sin(time * 2 + it.phase) * 0.12 : 0;
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
    if (e.target && e.target.tagName === 'INPUT') return; // typing a name
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
        base = speedAt(MODES[freeRide ? 'easy' : modeId], elapsed);
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

    // Zones: new sky colours, and a toast with a chime while riding
    const z = zoneAt(ride.s);
    if (z.index !== zoneIndex) enterZone(z, gameState === 'PLAYING');
    scene.background.lerp(skyTarget, Math.min(1, dt * 0.6));
    scene.fog.color.copy(scene.background);

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
    boardModel.update(dt, time);
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

    renderer.render(scene, camera);
}

// UI buttons
document.querySelectorAll('.mode-btn').forEach(btn => btn.addEventListener('click', () => startGame(btn.dataset.mode)));
document.querySelectorAll('.lb-tab').forEach(btn => btn.addEventListener('click', () => {
    lbTab = btn.dataset.tab;
    renderStart();
}));
$('free-btn').addEventListener('click', () => startGame('free'));
$('restart-btn').addEventListener('click', () => startGame(modeId));
$('gameover-menu-btn').addEventListener('click', goToMenu);
$('menu-btn').addEventListener('click', goToMenu);

$('save-score-btn').addEventListener('click', () => {
    const name = $('player-name').value.trim() || 'Fairy Rider';
    store.addScore(modeId, name, scoring.score);
    $('new-high-score-section').classList.add('hidden');
    renderLeaderboard('gameover-lb', modeId);
});

newTrack(FREE_RIDE);
renderStart();
renderer.setAnimationLoop(frame);
