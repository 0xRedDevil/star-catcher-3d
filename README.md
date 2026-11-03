# Star Catcher 3D 🧚✨

Ride a rainbow board along an endless sky track that climbs, dips and swoops through space. Catch stars to build your combo. The 3D follow-up to [Fairy Star Catcher](https://github.com/0xRedDevil/fairy-star-catcher).

Play it at https://0xreddevil.github.io/star-catcher-3d/

- ⭐ Star: 10 points × combo
- 🌈 Distance: 1 point for every 4 units of track
- 🔥 Combo: every 3 catches in a row adds +1 to the multiplier, up to x5
- 🪄 The glowing walls keep you on the track, so you can't fall off

The track is generated as you ride, so every ride is different. Top 5 scores are saved in the browser (localStorage).

## Controls

- **Keyboard:** ← → arrow keys (or A / D). Escape ends the ride.
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
