import { TILE_SIZE, isMine, getTileKey, getNeighborMineCount } from './world.js';
import { playSound } from './assets.js';

// WebsimSocket is global
const room = new WebsimSocket();

export const gameState = {
    room: room,
    me: {
        x: 0,
        y: 0,
        score: 0,
        stunnedUntil: 0,
        username: 'Janitor'
    },
    tiles: {}, // Local cache of room state for tiles
    peers: {}
};

export async function initNetwork() {
    await room.initialize();  
    
    document.getElementById('connection-status').innerText = "Connected";

    // Initial spawn point randomization to spread players out
    gameState.me.x = (Math.random() * 1000 - 500);
    gameState.me.y = (Math.random() * 1000 - 500);

    // Subscribe to changes
    room.subscribeRoomState((state) => {
        if (state.tiles) {
            // Merge updates
            gameState.tiles = { ...gameState.tiles, ...state.tiles };
        }
    });

    room.subscribePresence((presence) => {
        gameState.peers = presence;
    });

    room.onmessage = (event) => {
        const { type, x, y, username } = event.data;
        if (type === 'sound_sweep') {
            // Positional sound check could go here, for now just global slightly quieter
            // playSound('sweep'); // Too noisy if everyone triggers it
        }
        if (type === 'notification') {
            showNotification(event.data.message);
        }
    };

    // Update loop for sending our position
    setInterval(() => {
        room.updatePresence({
            x: gameState.me.x,
            y: gameState.me.y,
            stunned: Date.now() < gameState.me.stunnedUntil,
            score: gameState.me.score
        });
    }, 50);
}

// Game Actions

export function sweepTile(gx, gy) {
    const key = getTileKey(gx, gy);
    const existing = gameState.tiles[key];

    // Already processed?
    if (existing) return;

    if (isMine(gx, gy)) {
        // OH NO! You swept a Possession!
        playSound('oops');
        gameState.me.stunnedUntil = Date.now() + 3000;
        showNotification("You tripped over a Possession! Stunned!");
        
        // Mark as "tripped" (revealed mine)
        room.updateRoomState({
            tiles: { [key]: { type: 'tripped', by: room.clientId } }
        });
    } else {
        playSound('sweep');
        // Good sweep
        const neighbors = getNeighborMineCount(gx, gy);
        
        // Optimistic update
        gameState.tiles[key] = { type: 'revealed', count: neighbors };

        room.updateRoomState({
            tiles: { [key]: { type: 'revealed', count: neighbors } }
        });

        // Flood fill if 0? Use recursion with caution in updateRoomState
        // For simplicity in multiplayer, we limit auto-sweep to immediate area or just click-by-click
        // to prevent massive bandwidth spikes on one click.
    }
}

export function claimTile(gx, gy) {
    const key = getTileKey(gx, gy);
    const existing = gameState.tiles[key];

    if (existing) return; // Already done

    if (isMine(gx, gy)) {
        playSound('claim');
        gameState.me.score += 100;
        document.getElementById('score').innerText = gameState.me.score;
        showNotification("CLAIMED! IT'S YOURS!");
        
        room.updateRoomState({
            tiles: { [key]: { type: 'claimed', by: room.clientId } }
        });
    } else {
        // False claim!
        playSound('oops');
        gameState.me.score -= 50;
        document.getElementById('score').innerText = gameState.me.score;
        showNotification("That's trash, not treasure!");
        
        // Mark as failed claim (just reveal it as empty)
        const neighbors = getNeighborMineCount(gx, gy);
        room.updateRoomState({
            tiles: { [key]: { type: 'revealed', count: neighbors } }
        });
    }
}

function showNotification(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerText = msg;
    document.getElementById('notifications').appendChild(el);
    setTimeout(() => el.remove(), 2000);
}