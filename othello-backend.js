const OthelloGame = require('./gameLogic');

module.exports = function(ioInstance, broadcastHubUpdate) {
  const io = ioInstance.of('/othello');
  
  const games = {};
  const rooms = {};

  function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  io.on('connection', (socket) => {
    console.log('A user connected to Othello:', socket.id);

    socket.on('createRoom', (playerName) => {
      let roomCode = generateRoomCode();
      while (rooms[roomCode]) {
        roomCode = generateRoomCode();
      }

      games[roomCode] = new OthelloGame();
      rooms[roomCode] = {
        players: { [socket.id]: 'black' },
        playersInfo: { [socket.id]: { id: socket.id, name: playerName || 'Player 1', color: 'black' } }
      };
      
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode, color: 'black' });
    });

    socket.on('createAiRoom', (playerName) => {
      const roomCode = 'AI_' + generateRoomCode();
      games[roomCode] = new OthelloGame();
      rooms[roomCode] = {
        isAi: true,
        players: { [socket.id]: 'black', 'ai': 'white' },
        playersInfo: { 
           [socket.id]: { id: socket.id, name: playerName || 'Player 1', color: 'black' },
           'ai': { id: 'ai', name: 'Computer AI', color: 'white' }
        }
      };
      socket.join(roomCode);
      socket.emit('roomCreated', { roomCode, color: 'black' });
      
      io.to(roomCode).emit('gameStart', {
        players: rooms[roomCode].playersInfo,
        gameState: games[roomCode].getState()
      });
    });

    socket.on('joinRoom', ({ roomCode, playerName }) => {
      if (!roomCode) return;
      roomCode = roomCode.toUpperCase();
      
      if (!rooms[roomCode]) return socket.emit('error', 'Room not found. Please check the code.');
      
      const playersIds = Object.keys(rooms[roomCode].players);
      if (playersIds.length >= 2) return socket.emit('error', 'Room is currently full.');
      if (playersIds.includes(socket.id)) return socket.emit('error', 'You are already in this room.');

      socket.join(roomCode);
      rooms[roomCode].players[socket.id] = 'white';
      rooms[roomCode].playersInfo[socket.id] = { id: socket.id, name: playerName || 'Player 2', color: 'white' };

      socket.emit('roomJoined', { roomCode, color: 'white' });

      io.to(roomCode).emit('gameStart', {
        players: rooms[roomCode].playersInfo,
        gameState: games[roomCode].getState()
      });
      if (broadcastHubUpdate) broadcastHubUpdate(`[Othello] Match started in Room ${roomCode}!`);
    });

    socket.on('makeMove', ({ roomCode, row, col }) => {
      const room = rooms[roomCode];
      if (!room) return;
      const color = room.players[socket.id];
      if (!color) return;
      
      const game = games[roomCode];
      if (!game) return;

      const result = game.makeMove(row, col, color);
      
      if (result) {
        io.to(roomCode).emit('moveMade', {
          row, col, color,
          flips: result.flips,
          gameState: game.getState()
        });

        if (game.getState().gameOver) {
            const score = game.getState().score;
            let winner = 'Nobody';
            if (score.black > score.white) winner = 'Black';
            if (score.white > score.black) winner = 'White';
            broadcastHubUpdate(`[Othello] Match in Room ${roomCode} ended! ${winner} wins.`);
        }

        function triggerAITurn() {
            if (!rooms[roomCode] || !games[roomCode]) return;
            const currentGameState = game.getState();
            if (currentGameState.gameOver || currentGameState.currentTurn !== 'white') return;

            setTimeout(() => {
               const validMoves = game.getValidMoves('white');
               if (validMoves.length > 0) {
                   let bestMove = validMoves[0];
                   let maxFlips = -1;
                   
                   validMoves.forEach(([r, c]) => {
                       let flipsCount = 0;
                       OthelloGame.DIRECTIONS.forEach(([dr, dc]) => {
                           flipsCount += game.checkDirection(r, c, dr, dc, 'white').length;
                       });
                       
                       const isCorner = (r === 0 || r === 7) && (c === 0 || c === 7);
                       const isEdge = r === 0 || r === 7 || c === 0 || c === 7;
                       let heuristic = flipsCount * 10;
                       if (isCorner) heuristic += 500;
                       else if (isEdge) heuristic += 50;

                       if (heuristic > maxFlips) {
                           maxFlips = heuristic;
                           bestMove = [r, c];
                       }
                   });

                   const aiResult = game.makeMove(bestMove[0], bestMove[1], 'white');
                   if (aiResult) {
                       io.to(roomCode).emit('moveMade', {
                           row: bestMove[0], col: bestMove[1], color: 'white',
                           flips: aiResult.flips,
                           gameState: game.getState()
                       });
                       
                       if (game.getState().currentTurn === 'white' && !game.getState().gameOver) {
                           triggerAITurn();
                       }
                   }
               }
            }, 800);
        }

        if (room.isAi && color === 'black' && game.getState().currentTurn === 'white') {
            triggerAITurn();
        }

      } else {
        socket.emit('invalidMove');
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from Othello:', socket.id);
      for (const roomCode in rooms) {
        if (rooms[roomCode].players[socket.id]) {
          io.to(roomCode).emit('playerDisconnected');
          delete rooms[roomCode];
          delete games[roomCode];
          break; 
        }
      }
    });
  });
};
