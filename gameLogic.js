class OthelloGame {
    constructor() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.board[3][3] = 'white';
        this.board[3][4] = 'black';
        this.board[4][3] = 'black';
        this.board[4][4] = 'white';
        this.currentTurn = 'black'; // Black always goes first
        this.gameOver = false;
        this.winner = null;
        this.blackScore = 2;
        this.whiteScore = 2;
    }

    // Directions for checking flips (8 directions)
    static DIRECTIONS = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    isValidMove(row, col, color) {
        if (this.board[row][col] !== null) return false;
        
        let valid = false;
        for (let [dr, dc] of OthelloGame.DIRECTIONS) {
            if (this.checkDirection(row, col, dr, dc, color).length > 0) {
                valid = true;
                break;
            }
        }
        return valid;
    }

    checkDirection(row, col, dr, dc, color) {
        let r = row + dr;
        let c = col + dc;
        let opponent = color === 'black' ? 'white' : 'black';
        let flips = [];

        while (r >= 0 && r < 8 && c >= 0 && c < 8 && this.board[r][c] === opponent) {
            flips.push([r, c]);
            r += dr;
            c += dc;
        }

        if (r >= 0 && r < 8 && c >= 0 && c < 8 && this.board[r][c] === color && flips.length > 0) {
            return flips;
        }
        return [];
    }

    getValidMoves(color) {
        let validMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isValidMove(r, c, color)) {
                    validMoves.push([r, c]);
                }
            }
        }
        return validMoves;
    }

    makeMove(row, col, color) {
        if (this.gameOver || this.currentTurn !== color || !this.isValidMove(row, col, color)) {
            return false;
        }

        let totalFlips = [];
        OthelloGame.DIRECTIONS.forEach(([dr, dc]) => {
            let flips = this.checkDirection(row, col, dr, dc, color);
            totalFlips.push(...flips);
        });

        if (totalFlips.length > 0) {
            this.board[row][col] = color;
            totalFlips.forEach(([r, c]) => {
                this.board[r][c] = color;
            });
            this.updateScores();
            
            // Toggle turn
            let nextTurn = color === 'black' ? 'white' : 'black';
            
            // Check if next player has valid moves
            if (this.getValidMoves(nextTurn).length > 0) {
                this.currentTurn = nextTurn;
            } else if (this.getValidMoves(color).length > 0) {
                // Next player has no moves, current player goes again
                // this.currentTurn remains same
            } else {
                // Neither player has moves
                this.endGame();
            }
            return {
                success: true,
                flips: totalFlips
            };
        }
        return false;
    }

    updateScores() {
        let black = 0;
        let white = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === 'black') black++;
                else if (this.board[r][c] === 'white') white++;
            }
        }
        this.blackScore = black;
        this.whiteScore = white;
    }

    endGame() {
        this.gameOver = true;
        this.updateScores();
        if (this.blackScore > this.whiteScore) this.winner = 'black';
        else if (this.whiteScore > this.blackScore) this.winner = 'white';
        else this.winner = 'tie';
    }

    getState() {
        return {
            board: this.board,
            currentTurn: this.currentTurn,
            gameOver: this.gameOver,
            winner: this.winner,
            blackScore: this.blackScore,
            whiteScore: this.whiteScore
        };
    }
}

module.exports = OthelloGame;
