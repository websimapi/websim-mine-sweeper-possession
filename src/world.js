/**
 * Deterministic World Generation
 * Uses a simple hashing function to determine if a tile is a "Possession" (Mine)
 * regardless of who is looking at it.
 */

// Simple seeded random to keep chunks consistent across clients
function seededRandom(x, y) {
    const seed = 1337; // Universe seed
    const n = x * 374761393 + y * 668265263;
    const m = (n ^ (n >> 13)) * 1274126177;
    return ((m ^ (m >> 16)) >>> 0) / 4294967296;
}

export const TILE_SIZE = 48; // Pixels
export const CHUNK_SIZE = 16; // Tiles per chunk side
const MINE_THRESHOLD = 0.15; // 15% chance of a mine

export function isMine(x, y) {
    return seededRandom(x, y) < MINE_THRESHOLD;
}

export function getNeighborMineCount(x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (isMine(x + dx, y + dy)) {
                count++;
            }
        }
    }
    return count;
}

// Convert world pixel coordinates to grid coordinates
export function worldToGrid(px, py) {
    return {
        x: Math.floor(px / TILE_SIZE),
        y: Math.floor(py / TILE_SIZE)
    };
}

// Key for storing state in the room object
export function getTileKey(gx, gy) {
    return `${gx},${gy}`;
}