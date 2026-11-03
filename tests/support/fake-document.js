// The models and sky draw glow textures on a canvas; this tiny stand-in lets them load in Node.
// Import it before anything that imports js/models.js.
globalThis.document ??= {
    createElement: () => ({
        getContext: () => ({
            createRadialGradient: () => ({ addColorStop() {} }),
            createLinearGradient: () => ({ addColorStop() {} }),
            fillRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            fill() {},
        }),
    }),
};
