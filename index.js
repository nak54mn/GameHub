const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 8080;

// 0. Hub Live Panel
const hubIo = io.of('/hub');
let recentLogs = [];
function broadcastHubUpdate(msg) {
    const log = { time: new Date().toLocaleTimeString(), text: msg };
    recentLogs.unshift(log);
    if (recentLogs.length > 10) recentLogs.pop();
    hubIo.emit('liveUpdate', log);
}
hubIo.on('connection', (socket) => {
    socket.emit('liveHistory', recentLogs);
});

// 1. Load Game Backends
require('./othello-backend')(io, broadcastHubUpdate);
require('./checkers-backend')(io, broadcastHubUpdate);

// 1.5 Global Leaderboard for Merge Game
let mergeLeaderboard = [];
app.use(express.json());

app.get('/api/leaderboard', (req, res) => {
    res.json(mergeLeaderboard);
});

app.post('/api/leaderboard', (req, res) => {
    const { name, score } = req.body;
    if (!name || typeof score !== 'number') return res.status(400).send('Invalid data');
    
    // Auto replace previous score if same name
    const existing = mergeLeaderboard.findIndex(e => e.name === name);
    if (existing !== -1) {
        if (score > mergeLeaderboard[existing].score) {
            mergeLeaderboard[existing].score = score;
        }
    } else {
        mergeLeaderboard.push({ name: name.substring(0, 15), score });
    }
    
    mergeLeaderboard.sort((a, b) => b.score - a.score);
    mergeLeaderboard = mergeLeaderboard.slice(0, 10);
    res.json(mergeLeaderboard);
});

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
