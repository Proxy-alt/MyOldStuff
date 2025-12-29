import fs from "fs";
import path from "path";

// Paths
const jsonPath = "./src/data/games.json";
const sourceRoot = "./public/storage/ag/g";
const destRoot = "./src/assets/images/games";

// Ensure destination exists
fs.mkdirSync(destRoot, { recursive: true });

// Load JSON
const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

data.games = data.games.map((game) => {
    if (!game.imageUrl) return game;

    // Extract original filename
    const originalFileName = path.basename(game.imageUrl);

    // Extract parent folder (e.g., "yohoho")
    const parentFolder = game.imageUrl
        .replace("../ag/g/", "")
        .split("/")[0];

    // Extract extension
    const ext = path.extname(originalFileName);

    // Normalized filename: parentFolder + extension
    const normalizedFileName = `${parentFolder}${ext}`;

    // Build source path
    const relativePath = game.imageUrl.replace("../ag/g/", "");
    const sourceFile = path.join(sourceRoot, relativePath);

    // Only migrate if the file actually exists in /public/storage/ag/g/
    if (fs.existsSync(sourceFile)) {
        const destFile = path.join(destRoot, normalizedFileName);

        // Copy and overwrite if needed
        fs.copyFileSync(sourceFile, destFile);
        console.log(`Migrated (or overwritten): ${normalizedFileName}`);

        // Update JSON path
        game.imageUrl = `../assets/images/games/${normalizedFileName}`;
    } else {
        console.log(`Skipped (not in /public/storage/ag/g/): ${game.imageUrl}`);
    }

    return game;
});

// Save updated JSON
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
console.log("Migration complete.");
