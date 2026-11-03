// Fog that hides new track and obstacles until they are close enough to see coming.
// Three.js normally measures fog straight ahead of the camera, which lets things on a bend
// appear at the side of the screen; measuring the true distance hides them evenly.
export const FOG_NEAR = 60;
export const FOG_FAR = 125;

export function useDistanceFog(THREE) {
    THREE.ShaderChunk.fog_vertex = THREE.ShaderChunk.fog_vertex.replace(
        'vFogDepth = - mvPosition.z;',
        'vFogDepth = length( mvPosition.xyz );'
    );
}

// How hidden something is at a distance (0 clear, 1 gone), the same way three.js linear fog works
export function fogAmount(distance) {
    const t = Math.max(0, Math.min(1, (distance - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
    return t * t * (3 - 2 * t);
}
