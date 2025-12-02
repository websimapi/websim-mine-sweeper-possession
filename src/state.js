import { TILE_SIZE, isMine, getTileKey, getNeighborMineCount } from './world.js';
import { playSound } from './assets.js';

// WebsimSocket is global
const room = new WebsimSocket();

export const SKINS = {
    'default': { id: 'default', name: 'Standard Blue', cost: 0, hue: 0 },
    'red': { id: 'red', name: 'Hazard Red', cost: 500, hue: 140 },
    'green': { id: 'green', name: 'Eco Green', cost: 1000, hue: 260 },
    'purple': { id: 'purple', name: 'Void Purple', cost: 2500, hue: 60 },
    'gold': { id: 'gold', name: 'Gold Master', cost: 5000, hue: 180, glow: true },
    'inverted': { id: 'inverted', name: 'Negative', cost: 10000, hue: 0, invert: true }
};

// Load saved data
const savedData = JSON.parse(localStorage.getItem('minesweeper_save') || '{}');

export const gameState = {
    room: room,
    me: {
        x: 0,
        y: 0,
        score: savedData.score || 0,
        stunnedUntil: 0,
        username: 'Janitor',
        skin: savedData.skin || 'default',
        unlockedSkins: savedData.unlockedSkins || ['default']
    },
    tiles: {}, // Local cache of room state for tiles
    peers: {}
};

function saveProgress() {
    localStorage.setItem('minesweeper_save', JSON.stringify({
        score: gameState.me.score,
        skin: gameState.me.skin,
        unlockedSkins: gameState.me.unlockedSkins
    }));
}

export async function initNetwork() {
    await room.initialize();  
    
    document.getElementById('connection-status').innerText = "Connected";
    document.getElementById('score').innerText = gameState.me.score;

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
            score: gameState.me.score,
            skin: gameState.me.skin
        });
    }, 50);
}

// Shop Actions
export function buySkin(skinId) {
    const skin = SKINS[skinId];
    if (!skin) return false;
    
    if (gameState.me.unlockedSkins.includes(skinId)) {
        // Already owned, just equip
        gameState.me.skin = skinId;
        saveProgress();
        return true;
    }

    if (gameState.me.score >= skin.cost) {
        gameState.me.score -= skin.cost;
        gameState.me.unlockedSkins.push(skinId);
        gameState.me.skin = skinId;
        document.getElementById('score').innerText = gameState.me.score;
        saveProgress();
        playSound('claim'); // Satisfaction sound
        return true;
    }

    playSound('oops');
    return false;
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
        saveProgress();
        document.getElementById('score').innerText = gameState.me.score;
        showNotification("CLAIMED! IT'S YOURS!");
        
        room.updateRoomState({
            tiles: { [key]: { type: 'claimed', by: room.clientId } }
        });
    } else {
        // False claim!
        playSound('oops');
        gameState.me.score -= 50;
        saveProgress();
        document.getElementById('score').innerText = gameState.me.score;
        showNotification("That's trash (-50 pts)");
        
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