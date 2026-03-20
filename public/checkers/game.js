const socket = io('/checkers');

// UI Elements
const startScreen = document.getElementById('start-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const playerNameInput = document.getElementById('player-name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const joinRoomInput = document.getElementById('join-room-input');
const playAiBtn = document.getElementById('play-ai-btn');
const lobbyError = document.getElementById('lobby-error');
const displayRoomCode = document.getElementById('display-room-code');
const lobbyPlayerList = document.getElementById('lobby-player-list');
const startGameBtn = document.getElementById('start-game-btn');
const waitingForHostMsg = document.getElementById('waiting-for-host-msg');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const gameRoomCodeTag = document.getElementById('game-room-code-tag');
const myName = document.getElementById('my-name');
const myColorDot = document.getElementById('my-color-dot');
const inGamePlayerList = document.getElementById('ingame-player-list');
const boardEl = document.getElementById('chinese-checkers-board');
const endTurnBtn = document.getElementById('end-turn-btn');
const turnStatusText = document.getElementById('turn-status-text');

// State
let roomCode = null;
let me = null; // { id, name, color, turnIndex }
let players = [];
let isHost = false;
let gameStarted = false;

// Board State
const rows = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
let holes = []; // Array of { id, x, y, r, c, marbleColor }
const dx = 34; // horizontal spacing slightly tighter
const dy = dx * Math.sin(Math.PI / 3);
const max_cols = 13;

let activeTurnIndex = 0; // 0, 1, or 2
let selectedMarble = null; // hole id
let hasJumpedThisTurn = false; // To enforce multi-jump rules

let isAiMode = false;

// Intercept network calls
function sendMakeMove(fromId, toId, isJump) {
    if (isAiMode) return;
    socket.emit('makeMove', roomCode, { fromId, toId, isJump });
}

function sendEndTurn() {
    if (isAiMode) return;
    socket.emit('endTurn', roomCode);
}

// Socket Listeners
createRoomBtn.addEventListener('click', () => {
    socket.emit('createRoom', playerNameInput.value.trim());
});

joinRoomBtn.addEventListener('click', () => {
    const code = joinRoomInput.value.trim().toUpperCase();
    if (code.length > 0) socket.emit('joinRoom', code, playerNameInput.value.trim());
});

playAiBtn.addEventListener('click', () => {
    isAiMode = true;
    me = { id: 'p1', name: playerNameInput.value.trim() || 'You', color: 'red', turnIndex: 0 };
    players = [
        me,
        { id: 'ai1', name: 'AI Yellow', color: 'yellow', turnIndex: 1 },
        { id: 'ai2', name: 'AI Blue', color: 'blue', turnIndex: 2 }
    ];
    roomCode = 'OFFLINE';
    isHost = true;
    gameStarted = true;
    showGameScreen();
    initBoard();
    updateGameHeader();
    renderBoard();
});

startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', roomCode);
});

leaveLobbyBtn.addEventListener('click', () => { window.location.reload(); });

endTurnBtn.addEventListener('click', () => {
    if (gameStarted && players[activeTurnIndex].id === me.id) {
        sendEndTurn();
        nextTurn();
    }
});

socket.on('errorMsg', (msg) => {
    lobbyError.innerText = msg;
    setTimeout(() => lobbyError.innerText = '', 3000);
});

socket.on('roomCreated', (code, player) => {
    roomCode = code; me = player; isHost = true;
    showWaitingScreen();
});

socket.on('roomJoined', (code, player) => {
    roomCode = code; me = player; isHost = false;
    showWaitingScreen();
});

socket.on('lobbyUpdate', (lobbyPlayers, hostId) => {
    players = lobbyPlayers;
    lobbyPlayerList.innerHTML = '';
    players.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="color-dot ${p.color}" style="margin-right:10px;"></span> ${p.name} ${p.id === hostId ? '(Host)' : ''}`;
        lobbyPlayerList.appendChild(li);
    });
    
    // Fill remaining spots
    for(let i = players.length; i < 3; i++) {
        const li = document.createElement('li');
        li.style.color = 'var(--text-muted)';
        li.innerText = 'Waiting for player...';
        lobbyPlayerList.appendChild(li);
    }
    document.getElementById('lobby-status').innerText = `Waiting for players to join (${players.length}/3)`;
});

socket.on('lobbyFull', () => {
    if (isHost) {
        startGameBtn.classList.remove('hidden');
        waitingForHostMsg.classList.add('hidden');
    }
});

socket.on('gameStart', (roomPlayers) => {
    players = roomPlayers;
    gameStarted = true;
    showGameScreen();
    initBoard();
    updateGameHeader();
    renderBoard();
});

socket.on('playerDisconnected', (name) => {
    alert(`${name} disconnected! Game over.`);
    window.location.reload();
});

socket.on('receiveMove', (moveData) => {
    executeMoveLocally(moveData.fromId, moveData.toId);
    if (!moveData.isJump) {
        // Single steps automatically end turn.
        nextTurn();
    } else {
        // It was a jump. We must wait for 'turnEnded' or another 'receiveMove'.
        renderBoard(); // Render the intermediate jump
    }
});

socket.on('turnEnded', () => {
    nextTurn();
});


// UI Transitions
function showWaitingScreen() {
    startScreen.classList.remove('active'); startScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden'); waitingScreen.classList.add('active');
    displayRoomCode.innerText = roomCode;
    if (isHost) {
         startGameBtn.classList.remove('hidden'); // allow early start for testing
         waitingForHostMsg.classList.add('hidden');
    }
}

function showGameScreen() {
    waitingScreen.classList.remove('active'); waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden'); gameScreen.classList.add('active');
    gameRoomCodeTag.innerText = roomCode;
    myName.innerText = me.name;
    myColorDot.className = `color-dot ${me.color}`;
}

function updateGameHeader() {
    inGamePlayerList.innerHTML = '';
    players.forEach((p, index) => {
        const li = document.createElement('li');
        if (index === activeTurnIndex) li.classList.add('active-turn');
        li.innerHTML = `<span class="color-dot ${p.color}"></span> ${p.name}`;
        inGamePlayerList.appendChild(li);
    });
    
    const activePlayer = players[activeTurnIndex];
    if (activePlayer.id === me.id) {
        turnStatusText.innerText = "Your Turn!";
        endTurnBtn.classList.remove('hidden');
        endTurnBtn.disabled = !hasJumpedThisTurn;
    } else {
        turnStatusText.innerText = `${activePlayer.name}'s Turn`;
        endTurnBtn.classList.add('hidden');
    }
}

// Board & Game Logic
function initBoard() {
    holes = [];
    let redCount = 0, yellowCount = 0, blueCount = 0;
    
    // Board is 440px wide. We center it by adding a global offset.
    const boardCenterY = 440 / 2;
    const boardCenterX = 440 / 2;
    
    // The top row (0) y is 0 * dy, bottom is 16 * dy = 16 * 29.4 = 470 (slightly too big).
    // Let's adjust scale. Board height is max ~470px.
    const totalHeight = 16 * dy;
    const offsetY = boardCenterY - totalHeight / 2;
    // Max width is row 4/12 which is 13 * dx = 442px
    const totalWidth = (max_cols-1) * dx;
    const offsetX = boardCenterX - totalWidth / 2;

    for (let r = 0; r < rows.length; r++) {
        let rowLen = rows[r];
        let startX = offsetX + ((max_cols - rowLen) / 2) * dx;
        
        for (let c = 0; c < rowLen; c++) {
            let x = startX + c * dx;
            let y = offsetY + r * dy;
            
            let color = null;
            // Chinese Checkers 3 players: top, bottom-left, bottom-right corners.
            // 3-player typical placement: 
            // - Player 1 (Red): Top 4 rows (0,1,2,3).
            // - Player 2 (Yellow): Bottom-left point? No, standard 3 player is spaced out.
            // Spacing: Top (Red), Bottom-Right (Yellow), Bottom-Left (Blue) is typical for 3 players.
            
            if (r <= 3) {
                color = 'red';
            } else if (r >= 9 && r <= 12 && c >= (rowLen - (r - 9) - 4) && c >= rowLen / 2) {
                // Approximate bottom right
                // Actually, let's just color the 10 spots for Yellow (Bottom Right).
                // It's easier: bottom right triangle is:
                // r=13(length 4), r=12(rightmost 4), etc. 
                // Wait, standard bottom right triangle is:
                // Rows 9 to 12.
                // It's the 4 triangles on the sides.
            }
            
            // To make setup flawless, use distance from corner centers!
            // Top corner center is (x0, y0).
            if (r <= 3) color = 'red'; // Top
            else if (r >= 13) color = null; // Bottom (Empty in 3-player)
            
            holes.push({
                id: `${r}-${c}`, x, y, r, c, marbleColor: color
            });
        }
    }
    
    // Rather than complex math for the other 2 colors, let's explicitly assign them.
    // Bottom-Left triangle:
    // Row 9: 1st spot. Row 10: 1st 2 spots. Row 11: 3 spots. Row 12: 4 spots.
    // Bottom-Right triangle:
    // Row 9: last spot. Row 10: last 2 spots. Row 11: last 3 spots. Row 12: last 4 spots.
    holes.forEach(h => {
        if (h.r >= 9 && h.r <= 12) {
            let numInTriangle = h.r - 8; // Row 9->1, 10->2, 11->3, 12->4
            if (h.c < numInTriangle) h.marbleColor = 'blue';
            let rowLen = rows[h.r];
            if (h.c >= rowLen - numInTriangle) h.marbleColor = 'yellow';
        }
    });
}

function renderBoard() {
    boardEl.innerHTML = '';
    
    holes.forEach(hole => {
        const hDiv = document.createElement('div');
        hDiv.className = 'hole';
        hDiv.style.left = hole.x + 'px';
        hDiv.style.top = hole.y + 'px';
        
        let isValidMoveTarget = false;
        
        // Render valid move highlights
        if (selectedMarble && !hole.marbleColor) {
            const moves = getValidMoves(selectedMarble);
            if (moves.find(m => m.id === hole.id)) {
                hDiv.classList.add('valid-move');
                isValidMoveTarget = true;
                hDiv.onclick = () => performMove(hole);
            }
        }
        
        if (selectedMarble === hole.id) {
            hDiv.classList.add('highlight'); // Highlight selected hole under marble
        }
        boardEl.appendChild(hDiv);
        
        // Render Marble
        if (hole.marbleColor) {
            const marble = document.createElement('div');
            marble.className = `marble ${hole.marbleColor}`;
            if (selectedMarble === hole.id) marble.classList.add('selected');
            
            marble.style.left = hole.x + 'px';
            marble.style.top = hole.y + 'px';
            
            // Can select only if it's our turn, our color, and we haven't jumped yet.
            const isActiveState = (gameStarted && players[activeTurnIndex].id === me.id && hole.marbleColor === me.color);
            
            if (isActiveState) {
                // If we jumped, we can only select the active jumping marble to continue.
                if (!hasJumpedThisTurn || selectedMarble === hole.id) {
                    marble.onclick = () => {
                        if (selectedMarble === hole.id && !hasJumpedThisTurn) {
                            selectedMarble = null; // deselect
                        } else {
                            // If we already jumped, we can't change marbles
                            if(!hasJumpedThisTurn) selectedMarble = hole.id; 
                        }
                        renderBoard();
                    };
                }
            }
            boardEl.appendChild(marble);
        }
    });
}

function getValidMoves(holeId) {
    const hole = holes.find(h => h.id === holeId);
    if (!hole) return [];
    
    let validMoves = [];
    const MAX_DIST = dx * 1.05; // Adjacency tolerance
    
    holes.forEach(target => {
        if (target.marbleColor || target.id === holeId) return; // Must be empty
        
        // Check single step
        let dist = Math.hypot(target.x - hole.x, target.y - hole.y);
        if (dist <= MAX_DIST && !hasJumpedThisTurn) {
            validMoves.push({ id: target.id, isJump: false });
        }
        
        // Check Jump
        // Distance to target should be ~2 * dx
        if (dist > MAX_DIST && dist <= dx * 2.1) {
            // Find if there is a marble EXACTLY in the middle
            let midX = (hole.x + target.x) / 2;
            let midY = (hole.y + target.y) / 2;
            
            let midHole = holes.find(m => Math.hypot(m.x - midX, m.y - midY) <= 10);
            if (midHole && midHole.marbleColor) {
                validMoves.push({ id: target.id, isJump: true });
            }
        }
    });
    
    return validMoves;
}

function performMove(targetHole) {
    const validMoves = getValidMoves(selectedMarble);
    const moveInfo = validMoves.find(m => m.id === targetHole.id);
    
    if (moveInfo) {
        const fromId = selectedMarble;
        executeMoveLocally(fromId, targetHole.id);
        sendMakeMove(fromId, targetHole.id, moveInfo.isJump);
        
        if (moveInfo.isJump) {
            hasJumpedThisTurn = true;
            selectedMarble = targetHole.id; // Keep selecting to allow multi-jump
            
            // Check if further jumps exist
            const nextMoves = getValidMoves(selectedMarble);
            if (nextMoves.length === 0) {
                // Auto-end if no more jumps
                sendEndTurn();
                nextTurn();
            } else {
                renderBoard();
                updateGameHeader(); // enable end turn button
            }
        } else {
            // Single step -> end turn
            selectedMarble = null;
            nextTurn();
        }
    }
}

function executeMoveLocally(fromId, toId) {
    const f = holes.find(h => h.id === fromId);
    const t = holes.find(h => h.id === toId);
    t.marbleColor = f.marbleColor;
    f.marbleColor = null;
}

function nextTurn() {
    activeTurnIndex = (activeTurnIndex + 1) % players.length;
    selectedMarble = null;
    hasJumpedThisTurn = false;
    updateGameHeader();
    renderBoard();
    
    if (isAiMode && players[activeTurnIndex].id !== me.id) {
        setTimeout(executeAITurn, 700);
    }
}

function executeAITurn() {
    if (!gameStarted) return;
    const aiColor = players[activeTurnIndex].color;
    
    // Find target corners for AI
    let targetX, targetY;
    if (aiColor === 'yellow') {
        const h = holes.find(hx => hx.r === 4 && hx.c === 0);
        targetX = h ? h.x : 0; targetY = h ? h.y : 0;
    } else {
         const rightHoles = holes.filter(hx2 => hx2.r === 4);
         const h = holes.find(hx => hx.r === 4 && hx.c === rightHoles.length - 1);
         targetX = h ? h.x : 440; targetY = h ? h.y : 0;
    }
    
    let myMarbles = holes.filter(h => h.marbleColor === aiColor);
    let bestStart = null, bestEnd = null, bestImprovement = -9999, isBestJump = false;

    // Evaluate all 1-step/1-jump valid moves to see which maximizes forward progress
    myMarbles.forEach(marble => {
        const startDist = Math.hypot(marble.x - targetX, marble.y - targetY);
        const moves = getValidMoves(marble.id);
        
        moves.forEach(m => {
            const targetHole = holes.find(h => h.id === m.id);
            const endDist = Math.hypot(targetHole.x - targetX, targetHole.y - targetY);
            const improvement = startDist - endDist;
            
            const score = improvement + (Math.random() * 5); // Add variance
            
            if (score > bestImprovement && improvement > 0) {
                bestImprovement = score; bestStart = marble.id; bestEnd = targetHole.id; isBestJump = m.isJump;
            }
        });
    });
    
    if (bestStart && bestEnd) {
        executeMoveLocally(bestStart, bestEnd);
        renderBoard();
        setTimeout(nextTurn, 500); // AI plays 1 move then yields (for simplicity)
    } else {
        // Fallback: Any valid move if stuck
        let moved = false;
        for (let marble of myMarbles) {
            const moves = getValidMoves(marble.id);
            if (moves.length > 0) {
                executeMoveLocally(marble.id, moves[0].id);
                moved = true;
                break;
            }
        }
        renderBoard();
        setTimeout(nextTurn, 500);
    }
}
