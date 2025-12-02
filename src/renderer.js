import { TILE_SIZE, getTileKey, worldToGrid, getNeighborMineCount } from './world.js';
import { getImage } from './assets.js';
import { gameState, SKINS } from './state.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

let width, height;

export function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false; // Pixel art look
}

window.addEventListener('resize', resize);
resize();

// Number colors for minesweeper
const colors = [
    null, 'blue', 'green', 'red', 'purple', 'maroon', 'turquoise', 'black', 'gray'
];

export function render() {
    // Clear screen
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    if (!gameState.room) return;

    const camX = gameState.me.x;
    const camY = gameState.me.y;

    const startCol = Math.floor((camX - width / 2) / TILE_SIZE);
    const endCol = Math.floor((camX + width / 2) / TILE_SIZE) + 1;
    const startRow = Math.floor((camY - height / 2) / TILE_SIZE);
    const endRow = Math.floor((camY + height / 2) / TILE_SIZE) + 1;

    // Draw Grid
    for (let y = startRow; y <= endRow; y++) {
        for (let x = startCol; x <= endCol; x++) {
            const screenX = Math.floor(x * TILE_SIZE - camX + width / 2);
            const screenY = Math.floor(y * TILE_SIZE - camY + height / 2);

            const key = getTileKey(x, y);
            const tileData = gameState.tiles[key];

            if (!tileData) {
                // Hidden
                ctx.drawImage(getImage('floor_hidden'), screenX, screenY, TILE_SIZE, TILE_SIZE);
            } else {
                // Revealed / Claimed / Tripped
                ctx.drawImage(getImage('floor_revealed'), screenX, screenY, TILE_SIZE, TILE_SIZE);

                if (tileData.type === 'revealed') {
                    if (tileData.count > 0) {
                        ctx.fillStyle = colors[tileData.count] || 'black';
                        ctx.font = 'bold 24px monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(tileData.count, screenX + TILE_SIZE/2, screenY + TILE_SIZE/2);
                    }
                } else if (tileData.type === 'claimed') {
                    // Draw possession + flag
                    const scale = 0.8;
                    const offset = (TILE_SIZE * (1-scale))/2;
                    ctx.drawImage(getImage('possession'), screenX + offset, screenY + offset, TILE_SIZE * scale, TILE_SIZE * scale);
                    ctx.drawImage(getImage('flag'), screenX, screenY, TILE_SIZE, TILE_SIZE);
                } else if (tileData.type === 'tripped') {
                    // Broken possession
                    ctx.globalAlpha = 0.5;
                    ctx.drawImage(getImage('possession'), screenX, screenY, TILE_SIZE, TILE_SIZE);
                    ctx.globalAlpha = 1.0;
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(screenX, screenY);
                    ctx.lineTo(screenX + TILE_SIZE, screenY + TILE_SIZE);
                    ctx.moveTo(screenX + TILE_SIZE, screenY);
                    ctx.lineTo(screenX, screenY + TILE_SIZE);
                    ctx.stroke();
                }
            }
            
            // Grid lines overlay for clarity
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX, screenY, TILE_SIZE, TILE_SIZE);
        }
    }

    // Draw Other Players
    for (const [id, peer] of Object.entries(gameState.peers)) {
        if (id === gameState.room.clientId) continue; // Skip self (drawn last)
        drawPlayer(peer.x, peer.y, peer.username, false, peer.stunned, peer.skin);
    }

    // Draw Self
    drawPlayer(gameState.me.x, gameState.me.y, gameState.me.username, true, Date.now() < gameState.me.stunnedUntil, gameState.me.skin);
}

function drawPlayer(x, y, username, isSelf, isStunned, skinId) {
    const screenX = Math.floor(x - gameState.me.x + width / 2);
    const screenY = Math.floor(y - gameState.me.y + height / 2);

    ctx.save();
    ctx.translate(screenX, screenY);

    if (isStunned) {
        ctx.rotate(Math.sin(Date.now() / 100) * 0.5); // Wobble
    }

    // Draw player sprite
    // Centered
    const pSize = TILE_SIZE;
    
    // Apply Skin Filters
    const skin = SKINS[skinId || 'default'] || SKINS['default'];
    
    let filterString = `hue-rotate(${skin.hue}deg)`;
    if (skin.invert) filterString += ' invert(100%)';
    if (skin.glow) filterString += ' drop-shadow(0 0 5px gold)';
    
    ctx.filter = filterString;
    ctx.drawImage(getImage('player'), -pSize/2, -pSize/2, pSize, pSize);
    ctx.filter = 'none'; // Reset filter for text

    // Name tag
    ctx.fillStyle = isSelf ? '#ffff00' : '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText(username || 'Janitor', 0, -pSize/2 - 5);
    ctx.shadowBlur = 0;

    if (isStunned) {
        ctx.fillStyle = 'red';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText("*STUNNED*", 0, -pSize/2 - 20);
    }

    ctx.restore();
}