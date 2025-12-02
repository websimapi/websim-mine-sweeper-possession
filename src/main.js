import { loadAssets } from './assets.js';
import { initNetwork, gameState, sweepTile, claimTile, SKINS, buySkin } from './state.js';
import { render, resize } from './renderer.js';
import { worldToGrid, TILE_SIZE } from './world.js';
import nipplejs from 'nipplejs';

const MOVEMENT_SPEED = 200; // Pixels per second

const input = {
    x: 0,
    y: 0,
    keys: {}
};

async function start() {
    await loadAssets();
    await initNetwork();    

    setupControls();    

    // Game Loop
    let lastTime = performance.now();
    function loop(now) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;

        update(dt);
        render();
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

function update(dt) {
    if (Date.now() < gameState.me.stunnedUntil) return; // Can't move while stunned

    // Normalize input vector
    let dx = input.x;
    let dy = input.y;    

    // Keyboard override
    if (input.keys['w']) dy = -1;
    if (input.keys['s']) dy = 1;
    if (input.keys['a']) dx = -1;
    if (input.keys['d']) dx = 1;

    // Normalize diagonal
    if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx*dx + dy*dy);
        if (len > 0) { // Fix divide by zero
             // If joystick, it might already be normalized 0-1, but keyboard isn't
             if (len > 1) {
                 dx /= len;
                 dy /= len;
             }
        }
        
        gameState.me.x += dx * MOVEMENT_SPEED * dt;
        gameState.me.y += dy * MOVEMENT_SPEED * dt;
    }
}

function setupControls() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
        document.getElementById('mobile-controls').style.display = 'block';
        
        // Joystick
        const manager = nipplejs.create({
            zone: document.getElementById('joystick-zone'),
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        manager.on('move', (evt, data) => {
            const angle = data.angle.radian;
            const force = Math.min(data.force, 1);
            input.x = Math.cos(angle) * force;
            input.y = -Math.sin(angle) * force; // Nipple Y is inverted relative to canvas
        });

        manager.on('end', () => {
            input.x = 0;
            input.y = 0;
        });

        // Buttons
        document.getElementById('btn-sweep').addEventListener('touchstart', (e) => {
            e.preventDefault();
            performAction('sweep');
        });
        document.getElementById('btn-claim').addEventListener('touchstart', (e) => {
            e.preventDefault();
            performAction('claim');
        });

    } else {
        // Desktop
        window.addEventListener('keydown', (e) => {
            input.keys[e.key.toLowerCase()] = true;
            if (e.code === 'Space') performAction('sweep');
            if (e.key.toLowerCase() === 'f') performAction('claim');
        });

        window.addEventListener('keyup', (e) => {
            input.keys[e.key.toLowerCase()] = false;
        });
    }

    // Shop UI
    const shopModal = document.getElementById('shop-modal');
    const shopList = document.getElementById('shop-list');
    
    document.getElementById('btn-open-shop').addEventListener('click', () => {
        shopModal.classList.remove('hidden');
        renderShop();
    });

    document.getElementById('btn-close-shop').addEventListener('click', () => {
        shopModal.classList.add('hidden');
    });

    function renderShop() {
        document.getElementById('shop-balance').innerText = `Points: ${gameState.me.score}`;
        shopList.innerHTML = '';
        
        Object.values(SKINS).forEach(skin => {
            const el = document.createElement('div');
            const owned = gameState.me.unlockedSkins.includes(skin.id);
            const equipped = gameState.me.skin === skin.id;
            const canAfford = gameState.me.score >= skin.cost;
            
            el.className = `shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''} ${(!owned && !canAfford) ? 'locked' : ''}`;
            
            let statusText = `${skin.cost} pts`;
            if (equipped) statusText = "EQUIPPED";
            else if (owned) statusText = "OWNED";
            
            el.innerHTML = `
                <div style="font-weight:bold">${skin.name}</div>
                <div>${statusText}</div>
            `;
            
            el.onclick = () => {
                if (buySkin(skin.id)) {
                    renderShop();
                }
            };
            
            shopList.appendChild(el);
        });
    }
}

function performAction(action) {
    if (document.getElementById('shop-modal').classList.contains('hidden') === false) return; // Shop open
    if (Date.now() < gameState.me.stunnedUntil) return;

    // Determine grid tile under player center
    const gridPos = worldToGrid(gameState.me.x, gameState.me.y);
    
    if (action === 'sweep') {
        sweepTile(gridPos.x, gridPos.y);
    } else if (action === 'claim') {
        claimTile(gridPos.x, gridPos.y);
    }
}

start();