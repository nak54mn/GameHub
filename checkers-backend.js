module.exports = function(ioInstance) {
    const io = ioInstance.of('/checkers');
    const rooms = {};
    const PLAYER_COLORS = ['red', 'yellow', 'blue'];
    
    function generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
  
    io.on('connection', (socket) => {
        console.log('User connected to Checkers:', socket.id);
  
        socket.on('createRoom', (playerName) => {
            const roomCode = generateRoomCode();
            rooms[roomCode] = {
                host: socket.id,
                started: false,
                players: [{
                    id: socket.id,
                    name: playerName || 'Host',
                    color: PLAYER_COLORS[0],
                    turnIndex: 0
                }]
            };
            socket.join(roomCode);
            socket.emit('roomCreated', roomCode, rooms[roomCode].players[0]);
            io.to(roomCode).emit('lobbyUpdate', rooms[roomCode].players, socket.id);
        });
  
        socket.on('joinRoom', (roomCode, playerName) => {
            const room = rooms[roomCode];
            if (room) {
                if (room.started) return socket.emit('errorMsg', 'Error: Game already started.');
                
                if (room.players.length < 3) {
                    const newPlayer = {
                        id: socket.id,
                        name: playerName || `Player ${room.players.length + 1}`,
                        color: PLAYER_COLORS[room.players.length],
                        turnIndex: room.players.length
                    };
                    room.players.push(newPlayer);
                    socket.join(roomCode);
                    
                    socket.emit('roomJoined', roomCode, newPlayer);
                    io.to(roomCode).emit('lobbyUpdate', room.players, room.host);
                    
                    if (room.players.length === 3) io.to(room.host).emit('lobbyFull');
                } else {
                    socket.emit('errorMsg', 'Error: Room is full (Max 3 players).');
                }
            } else {
                socket.emit('errorMsg', 'Error: Room not found.');
            }
        });
  
        socket.on('startGame', (roomCode) => {
            const room = rooms[roomCode];
            if (room && room.host === socket.id && !room.started) {
                if (room.players.length >= 2) {
                    room.started = true;
                    io.to(roomCode).emit('gameStart', room.players);
                } else {
                    socket.emit('errorMsg', 'Need at least 2 players to start.');
                }
            }
        });
  
        socket.on('makeMove', (roomCode, moveData) => {
            const room = rooms[roomCode];
            if (room && room.started) {
                 socket.to(roomCode).emit('receiveMove', moveData);
            }
        });
        
        socket.on('endTurn', (roomCode) => {
            const room = rooms[roomCode];
            if (room && room.started) {
                 socket.to(roomCode).emit('turnEnded');
            }
        })
  
        socket.on('disconnect', () => {
            console.log('User disconnected from Checkers:', socket.id);
            for (const roomCode in rooms) {
                const room = rooms[roomCode];
                const pIndex = room.players.findIndex(p => p.id === socket.id);
                if (pIndex !== -1) {
                    const disconnectedPlayer = room.players[pIndex].name;
                    room.players.splice(pIndex, 1);
                    
                    if (room.players.length === 0) {
                        delete rooms[roomCode];
                    } else {
                        if (room.host === socket.id) room.host = room.players[0].id;
                        if (room.started) {
                            socket.to(roomCode).emit('playerDisconnected', disconnectedPlayer);
                        } else {
                            io.to(roomCode).emit('lobbyUpdate', room.players, room.host);
                        }
                    }
                    break;
                }
            }
        });
    });
};
