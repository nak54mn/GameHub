const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 8080;

// 1. Load Game Backends
require('./othello-backend')(io);
require('./checkers-backend')(io);

// 2. Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));
// We previously mapped static files into 'public/othello', 'public/checkers', 'public/MergeGame.html'
// Express.static will automatically serve public/othello/index.html when hitting /othello/

// 3. Serve Merge Game explicitly on /merge if needed
const mergeGameFile = path.join(__dirname, 'public/MergeGame.html');
app.get('/merge', (req, res) => {
    if (fs.existsSync(mergeGameFile)) {
        res.sendFile(mergeGameFile, { dotfiles: 'allow' });
    } else {
        res.status(404).send('Merge Game file not found.');
    }
});

// Bind Master Server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n========================================`);
    console.log(`🌟 CLOUD MASTER SERVER IS ONLINE`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🕹️  Othello -> /othello/`);
    console.log(`🕹️  Checkers -> /checkers/`);
    console.log(`🕹️  Merge -> /merge`);
    console.log(`========================================\n`);
});
