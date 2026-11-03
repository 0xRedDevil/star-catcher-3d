# Star Catcher 3D 🧚✨

Ride a magic board along an endless glass sky track that climbs, dips and swoops through space. Dodge little UFOs, aliens, rockets, satellites, space crystals, moon rocks and rolling planets, and catch stars to build your combo. The 3D follow-up to [Fairy Star Catcher](https://github.com/0xRedDevil/fairy-star-catcher).

Play it at https://0xreddevil.github.io/star-catcher-3d/

- ⭐ Star: 10 points × combo
- 💖 Heart: 25 points × combo, plus a life (up to 5)
- ✨ Near miss: swerve close past an obstacle for 5 points × combo
- 🌈 Distance: 1 point for every 4 units of track
- 🔥 Combo: every 3 catches in a row adds +1 to the multiplier, up to x5. A bump resets it.
- ❤️ Lives: you start with 3. A bump costs one, then you blink and are safe for a moment. The ride ends at 0.
- 🪄 The glowing walls keep you on the track, so you can't fall off

There's always a clear way through each row of obstacles. The track is generated as you ride, so every ride is different.

### Modes

- **Easy 🌈**: 3 lives, and hearts can top you up to 5.
- **Hard 🔥**: 3 lives and no hearts. It's faster, with busier rows.
- **Free Ride 🌌**: the same track with no obstacles, stars, score or lives, just for the ride. Press **Menu** (or Escape) to go back.

Easy and Hard each keep their own top 5 and best score, saved in the browser (localStorage).

### Zones

The track passes through a new zone every 600 units: 🌌 Starlight Sea, 🍬 Candy Nebula, 💎 Crystal Galaxy, then the special 🌈 Rainbow Moon with its rainbow road. After that they start again as "Starlight Sea II" and so on.

### Boards

Score enough in a single ride, in either mode, to unlock a new board, and pick it on the start screen:

| Board | Unlock | Look |
|---|---|---|
| Starter | from the start | plain lilac |
| Candy | 2,000 | scrolling pink and mint swirl, pulsing pink glow, heart-sparkle trail |
| Galaxy | 5,000 | twinkling starfield, glowing cyan edge, star-dust trail |
| Super Rainbow | 10,000 | sliding rainbow stripes, orbiting gold stars, rainbow glitter trail |

UFOs drift side to side, so time your dodge, but there is always a clear way through.

### Skins

The obstacles come as a swappable skin. **Space Friends** is the default. **Fairy Forest** (crystal trees, toadstools, snowmen, fairy houses and storm clouds) is kept ready for a future skin picker, and a Christmas skin is planned.

## Controls

- **Keyboard:** ← → arrow keys (or A / D)
- **Mouse or touch:** drag left and right

## Run it locally

There's no build step. Serve the folder with any static server, for example:

```bash
python -m http.server 5175
```

Then open http://127.0.0.1:5175/. Three.js loads from a CDN, so an internet connection is needed.

## Tests

The track maths, riding and scoring are tested with Node's built-in test runner:

```bash
npm install
npm test
```

The design and build plan live in `docs/superpowers/`.
