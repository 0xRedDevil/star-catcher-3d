// The boards and the score you need in one ride to unlock each. Pure, no Three.js.
export const BOARDS = [
    { id: 'starter', name: 'Starter Board', unlockScore: 0 },
    { id: 'candy', name: 'Candy Board', unlockScore: 2000 },
    { id: 'galaxy', name: 'Galaxy Board', unlockScore: 5000 },
    { id: 'rainbow', name: 'Super Rainbow Board', unlockScore: 10000 },
];

export function unlocksFor(score) {
    return BOARDS.filter(b => score >= b.unlockScore).map(b => b.id);
}
