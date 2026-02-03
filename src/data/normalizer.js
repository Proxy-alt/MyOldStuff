import fs from 'fs';

const filePath = './games.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Unwrap nested ?url= parameters and strip interpreter wrappers
function unwrapUrl(url) {
    // Step 1: unwrap nested ?url= chains
    while (url.includes('?url=')) {
        url = url.split('?url=').pop();
    }

    // Step 2: remove interpreter wrapper
    url = url.replace('/pages/other/interpreter/index.html', '');

    // Step 3: remove iframe wrapper
    url = url.replace('/iframe.html', '');

    // Step 4: remove leftover ?url=
    url = url.replace(/^\/?url=/, '');

    return url;
}

// Convert final URL into /game/<path> but ONLY if it's from cdn.jsdelivr.net
function convertToGamePath(url) {
    // If already /game/... → leave it alone
    if (url.startsWith('/game/')) return url;

    // Unwrap and clean
    let cleaned = unwrapUrl(url);

    // If it doesn't contain cdn.jsdelivr.net → leave it unchanged
    if (!cleaned.includes('cdn.jsdelivr.net')) {
        return url;
    }

    // Remove protocol
    cleaned = cleaned.replace(/^https?:\/\//, '');

    // Remove domain (cdn.jsdelivr.net)
    cleaned = cleaned.replace(/^cdn\.jsdelivr\.net/, '');

    // Remove leading slashes
    cleaned = cleaned.replace(/^\/+/, '');

    // Remove leading "games/" folder
    cleaned = cleaned.replace(/^games\//, '');

    // Final rewritten path
    return `/game/${cleaned}`;
}

data.games = data.games.map(game => {
    game.url = convertToGamePath(game.url);
    return game;
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('games.json rewritten successfully.');
