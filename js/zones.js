// Named zones along the track. Each has its own road and sky colours; after the last
// one they start again as "II", "III" and so on. Pure, no Three.js.

export const ZONE_LENGTH = 600;

export const ZONES = [
    { id: 'starlight', name: 'Starlight Sea', sky: 0x150a2e, nebula: [0x9b6bff, 0x4fd8ff, 0xff5fd2] },
    { id: 'candy', name: 'Candy Nebula', sky: 0x2a0a2a, nebula: [0xff5fd2, 0xff9fd0, 0xffc46b] },
    { id: 'crystal', name: 'Crystal Galaxy', sky: 0x061a33, nebula: [0x4fd8ff, 0x7fe8ff, 0x9b6bff] },
    { id: 'rainbow', name: 'Rainbow Moon', sky: 0x1a0a33, nebula: [0xff4d6d, 0xffe66d, 0x38bdf8, 0xa78bfa] },
];

const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

export function zoneAt(s) {
    const index = Math.max(0, Math.floor(s / ZONE_LENGTH));
    const zone = ZONES[index % ZONES.length];
    const lap = Math.floor(index / ZONES.length);
    const suffix = lap < ROMAN.length ? ROMAN[lap] : ` ${lap + 1}`;
    return { index, zone, lap, name: zone.name + suffix, startS: index * ZONE_LENGTH };
}
