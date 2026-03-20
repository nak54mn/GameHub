const socket = io('/othello');

// UI Elements
const lobby = document.getElementById('lobby');
const waitingRoom = document.getElementById('waitingRoom');
const gameContainer = document.getElementById('gameContainer');

const playerNameInput = document.getElementById('playerName');
const roomCodeInput = document.getElementById('roomCodeInput');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const btnPlayAi = document.getElementById('btnPlayAi');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const lobbyMessage = document.getElementById('lobbyMessage');
const displayRoomCode = document.getElementById('displayRoomCode');

const boardEl = document.getElementById('board');
const p1Name = document.getElementById('p1Name');
const p2Name = document.getElementById('p2Name');
const blackScoreEl = document.getElementById('blackScore');
const whiteScoreEl = document.getElementById('whiteScore');
const turnIndicator = document.getElementById('turnIndicator');

const gameOverModal = document.getElementById('gameOverModal');
const winnerText = document.getElementById('winnerText');
const finalBlack = document.getElementById('finalBlack');
const finalWhite = document.getElementById('finalWhite');
const btnPlayAgain = document.getElementById('btnPlayAgain');

// Game State
let myColor = null;
let currentRoomCode = null;
let boardState = Array(8).fill(null).map(() => Array(8).fill(null));
let isMyTurn = false;
let playersInfo = {};

// -- LOBBY LOGIC --

btnCreateRoom.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) return showError('請輸入您的暱稱');
    socket.emit('createRoom', name);
});

btnPlayAi.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    socket.emit('createAiRoom', name || '玩家');
});

btnJoinRoom.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();
    if (!name) return showError('請輸入您的暱稱');
    if (code.length !== 4) return showError('請輸入 4 碼房間代碼');
    
    socket.emit('joinRoom', { roomCode: code, playerName: name });
});

function showError(msg) {
    lobbyMessage.textContent = msg;
    setTimeout(() => lobbyMessage.textContent = '', 3000);
}

socket.on('error', (msg) => {
    showError(msg);
});

socket.on('roomCreated', ({ roomCode, color }) => {
    myColor = color;
    currentRoomCode = roomCode;
    lobby.classList.remove('active');
    waitingRoom.classList.add('active');
    displayRoomCode.textContent = roomCode;
});

socket.on('roomJoined', ({ roomCode, color }) => {
    myColor = color;
    currentRoomCode = roomCode;
});

socket.on('gameStart', ({ players, gameState }) => {
    playersInfo = players;
    
    // Set names
    const blackPlayer = Object.values(players).find(p => p.color === 'black');
    const whitePlayer = Object.values(players).find(p => p.color === 'white');
    
    p1Name.textContent = blackPlayer ? blackPlayer.name : 'Player 1';
    p2Name.textContent = whitePlayer ? whitePlayer.name : 'Player 2';
    
    if (myColor === 'black') p1Name.textContent += ' (您)';
    else p2Name.textContent += ' (您)';

    waitingRoom.classList.remove('active');
    lobby.classList.remove('active');
    gameOverModal.classList.remove('active');
    gameContainer.classList.add('active');
    
    updateBoard(gameState);
});

socket.on('playerDisconnected', () => {
    alert('對手已斷線！');
    resetToLobby();
});

// -- GAME LOGIC --

function initializeBoardDOM() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            cell.addEventListener('click', () => {
                if (isMyTurn && cell.classList.contains('valid-move')) {
                    socket.emit('makeMove', { roomCode: currentRoomCode, row: r, col: c });
                }
            });
            
            boardEl.appendChild(cell);
        }
    }
}

function updateBoard(gameState) {
    boardState = gameState.board;
    isMyTurn = gameState.currentTurn === myColor;

    blackScoreEl.textContent = gameState.blackScore;
    whiteScoreEl.textContent = gameState.whiteScore;

    turnIndicator.classList.add('active');
    if (gameState.gameOver) {
        turnIndicator.textContent = '遊戲結束';
        turnIndicator.className = 'turn-indicator active';
    } else if (isMyTurn) {
        turnIndicator.textContent = '您的回合';
        turnIndicator.className = 'turn-indicator active your-turn';
    } else {
        turnIndicator.textContent = '對手的回合';
        turnIndicator.className = 'turn-indicator active opponent-turn';
    }

    const cells = boardEl.children;
    let localValidMoves = [];
    if (isMyTurn && !gameState.gameOver) {
        localValidMoves = getValidMovesForColor(myColor);
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const index = r * 8 + c;
            const cell = cells[index];
            const pieceVal = boardState[r][c];

            cell.classList.remove('valid-move');

            let pieceEl = cell.querySelector('.piece');

            if (pieceVal) {
                if (!pieceEl) {
                    pieceEl = document.createElement('div');
                    pieceEl.className = `piece is-${pieceVal} new`;
                    
                    const front = document.createElement('div');
                    front.className = 'face front';
                    const back = document.createElement('div');
                    back.className = 'face back';
                    
                    pieceEl.appendChild(front);
                    pieceEl.appendChild(back);
                    cell.appendChild(pieceEl);

                    // Remove new class to allow future normal manipulation
                    setTimeout(() => {
                        if (pieceEl) pieceEl.classList.remove('new');
                    }, 350);
                } else {
                    // It exists, just set appropriate class (triggers flip animation if changed)
                    pieceEl.className = `piece is-${pieceVal}`;
                }
            } else {
                const isValid = localValidMoves.some(m => m[0] === r && m[1] === c);
                if (isValid) {
                    cell.classList.add('valid-move');
                }
                
                if (pieceEl) pieceEl.remove();
            }
        }
    }

    if (gameState.gameOver) {
        showGameOver(gameState);
    }
}

socket.on('moveMade', ({ row, col, color, flips, gameState }) => {
    updateBoard(gameState);
});

const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
];

function getValidMovesForColor(color) {
    let validMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (isValidMoveLogic(r, c, color)) {
                validMoves.push([r, c]);
            }
        }
    }
    return validMoves;
}

function isValidMoveLogic(row, col, color) {
    if (boardState[row][col] !== null) return false;
    
    let valid = false;
    for (let [dr, dc] of DIRECTIONS) {
        let r = row + dr;
        let c = col + dc;
        let opponent = color === 'black' ? 'white' : 'black';
        let flips = [];

        while (r >= 0 && r < 8 && c >= 0 && c < 8 && boardState[r][c] === opponent) {
            flips.push([r, c]);
            r += dr;
            c += dc;
        }

        if (r >= 0 && r < 8 && c >= 0 && c < 8 && boardState[r][c] === color && flips.length > 0) {
            valid = true;
            break;
        }
    }
    return valid;
}

function showGameOver(gameState) {
    if (gameState.winner === 'tie') {
        winnerText.textContent = '平手！';
    } else if (gameState.winner === myColor) {
        winnerText.textContent = '您獲勝了！ 🎉';
    } else {
        winnerText.textContent = '您輸了！ 😢';
    }
    
    finalBlack.textContent = `黑子: ${gameState.blackScore}`;
    finalWhite.textContent = `白子: ${gameState.whiteScore}`;
    
    setTimeout(() => gameOverModal.classList.add('active'), 1000);
}

btnPlayAgain.addEventListener('click', resetToLobby);

function resetToLobby() {
    window.location.reload();
}

initializeBoardDOM();
