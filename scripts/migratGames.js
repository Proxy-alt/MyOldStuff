#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gamesPath = path.join(__dirname, '../src/data/games.json');

// Function to convert label to URL-safe ID
function labelToId(label) {
    return label
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s\-._~]/g, '') // Remove non-URL-safe characters
        .replace(/\s+/g, '-') // Convert spaces to dashes
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
}

// Read games.json
const data = JSON.parse(fs.readFileSync(gamesPath, 'utf-8'));

console.log(`Processing ${data.games.length} games...`);

// Process each game
data.games = data.games.map((game, index) => {
    // Add id if missing
    if (!game.id) {
        game.id = labelToId(game.label);
        console.log(`  Created id for "${game.label}": ${game.id}`);
    }

    // Add isHighlighted if missing (default to false)
    if (typeof game.isHighlighted === 'undefined') {
        game.isHighlighted = false;
        console.log(`  Added isHighlighted=false to "${game.label}"`);
    }

    return game;
});

// Write back to games.json
fs.writeFileSync(gamesPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
console.log(`\n✅ Migration complete! Updated ${gamesPath}`);
