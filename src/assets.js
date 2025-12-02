// Manages loading images and sounds

const images = {};
const sounds = {};

const imageSources = {
    'floor_hidden': 'dusty_tile.png',
    'floor_revealed': 'clean_tile.png',
    'possession': 'possession.png',
    'player': 'player.png',
    'flag': 'flag.png'
};

const soundSources = {
    'sweep': 'sweep.mp3',
    'claim': 'claim.mp3',
    'oops': 'oops.mp3'
};

export async function loadAssets() {
    const imagePromises = Object.entries(imageSources).map(([key, src]) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                images[key] = img;
                resolve();
            };
            img.onerror = reject;
        });
    });

    // Initialize Audio Context on first interaction later, but prep buffers
    window.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const soundPromises = Object.entries(soundSources).map(async ([key, src]) => {
        try {
            const response = await fetch(src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await window.audioContext.decodeAudioData(arrayBuffer);
            sounds[key] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound ${key}`, e);
        }
    });

    await Promise.all([...imagePromises, ...soundPromises]);
}

export function getImage(name) {
    return images[name];
}

export function playSound(name) {
    if (!sounds[name] || !window.audioContext) return;

    // Resume context if suspended (browser policy)
    if (window.audioContext.state === 'suspended') {
        window.audioContext.resume();
    }

    const source = window.audioContext.createBufferSource();
    source.buffer = sounds[name];
    source.connect(window.audioContext.destination);
    source.start(0);
}