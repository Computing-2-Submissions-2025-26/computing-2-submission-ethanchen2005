/*jslint long, white*/
import R from "./ramda.js";
/**
 * SlimeReaction.js models a turn-based pond game.
 * Players place slimes, full tiles split, and chain reactions can capture
 * tiles from the other player.
 * @namespace SlimeReaction
 */

/**
 * A player is one of the two slime teams on the pond.
 * @memberof SlimeReaction
 * @typedef {"blue" | "red"} Player
 */

/**
 * A difficulty chooses the size of the pond.
 * @memberof SlimeReaction
 * @typedef {"easy" | "medium" | "hard"} Difficulty
 */

/**
 * The game is either still being played, or has a winner.
 * @memberof SlimeReaction
 * @typedef {"playing" | "won"} GameStatus
 */

/**
 * A pond tile stores who owns it, how many slimes are on it,
 * and how many slimes it can hold before it splits.
 * @memberof SlimeReaction
 * @typedef {{owner: SlimeReaction.Player | null, count: number, capacity: number}} PondTile
 */

/**
 * A coordinate points to one tile in the pond.
 * Rows and columns are zero-based in the module.
 * @memberof SlimeReaction
 * @typedef {{row: number, column: number}} Coordinate
 */

/**
 * The public game state returned by this module.
 * Treat it as read-only and use the API to make the next state.
 * @memberof SlimeReaction
 * @typedef {Readonly<object>} GameState
 */

/**
 * Options for starting a game.
 * @memberof SlimeReaction
 * @typedef {object} GameOptions
 * @property {SlimeReaction.Difficulty} [difficulty] The named board size.
 * @property {number} [size] A custom square board size from 3 to 10.
 */

/**
 * The score for one player.
 * @memberof SlimeReaction
 * @typedef {{slimes: number, tiles: number}} Score
 */
const BLUE = "blue";
const RED = "red";
const EMPTY_OWNER = null;
const PLAYERS = Object.freeze([BLUE, RED]);
const PLAYER_NAMES = Object.freeze({
    blue: "Blue",
    red: "Red"
});
const DEFAULT_DIFFICULTY = "easy";
const DIFFICULTY_SIZES = Object.freeze({
    easy: 6,
    hard: 10,
    medium: 8
});
const MIN_SIZE = 3;
const MAX_SIZE = 10;
const OPENING_TURNS = 1;
const DIRECTIONS = Object.freeze([
    Object.freeze({
        column: 0,
        row: -1
    }),
    Object.freeze({
        column: 0,
        row: 1
    }),
    Object.freeze({
        column: -1,
        row: 0
    }),
    Object.freeze({
        column: 1,
        row: 0
    })
]);
const otherPlayer = function (player) {
    return (
        player === BLUE
        ? RED
        : BLUE
    );
};
const validDifficulty = function (difficulty) {
    return Object.hasOwn(DIFFICULTY_SIZES, difficulty);
};
const validSize = function (size) {
    return Number.isInteger(size) && size >= MIN_SIZE && size <= MAX_SIZE;
};
const inBounds = function (size, row, column) {
    return (
        Number.isInteger(row)
        && Number.isInteger(column)
        && row >= 0
        && row < size
        && column >= 0
        && column < size
    );
};
const makeCell = function (owner, count, capacity) {
    return {
        capacity,
        count,
        owner
    };
};
const copyCell = function (cell) {
    return makeCell(cell.owner, cell.count, cell.capacity);
};
const copyBoard = function (board) {
    return R.map(function (row) {
        return R.map(copyCell, row);
    }, board);
};
const copyStats = function (stats) {
    return {
        finalWinner: stats.finalWinner,
        largestChainReaction: stats.largestChainReaction,
        tilesCaptured: stats.tilesCaptured,
        totalExplosions: stats.totalExplosions,
        totalTurns: stats.totalTurns
    };
};
const copyTurns = function (turns) {
    return {
        blue: turns.blue,
        red: turns.red
    };
};
const copyMove = function (move) {
    if (move === null) {
        return null;
    }
    return Object.assign({}, move, {
        sequence: R.map(function (item) {
            return {
                column: item.column,
                owner: item.owner,
                row: item.row
            };
        }, move.sequence)
    });
};
const freezeBoard = function (board) {
    return Object.freeze(R.map(function (row) {
        return Object.freeze(R.map(function (cell) {
            return Object.freeze(copyCell(cell));
        }, row));
    }, board));
};
const freezeMove = function (move) {
    const copy = copyMove(move);
    if (copy === null) {
        return null;
    }
    return Object.freeze(Object.assign({}, copy, {
        sequence: Object.freeze(R.map(Object.freeze, copy.sequence))
    }));
};
const freezeState = function (state) {
    return Object.freeze({
        board: freezeBoard(state.board),
        currentPlayer: state.currentPlayer,
        difficulty: state.difficulty,
        history: Object.freeze(state.history.slice()),
        lastMove: freezeMove(state.lastMove),
        size: state.size,
        stats: Object.freeze(copyStats(state.stats)),
        status: state.status,
        turn: state.turn,
        turnsTaken: Object.freeze(copyTurns(state.turnsTaken)),
        winner: state.winner
    });
};
const blankStats = function () {
    return {
        finalWinner: null,
        largestChainReaction: 0,
        tilesCaptured: 0,
        totalExplosions: 0,
        totalTurns: 0
    };
};
const blankTurns = function () {
    return {
        blue: 0,
        red: 0
    };
};
const tileAt = function (board, row, column) {
    return board[row][column];
};
const setTile = function (board, row, column, nextCell) {
    return R.map(function (boardRow, rowIndex) {
        return R.map(function (cell, columnIndex) {
            if (rowIndex === row && columnIndex === column) {
                return copyCell(nextCell);
            }
            return copyCell(cell);
        }, boardRow);
    }, board);
};
const addSlime = function (board, row, column, player) {
    const cell = tileAt(board, row, column);
    return setTile(board, row, column, makeCell(player, cell.count + 1, cell.capacity));
};
const resetTile = function (board, row, column) {
    return setTile(board, row, column, makeCell(EMPTY_OWNER, 0, tileAt(board, row, column).capacity));
};
const unstable = function (cell) {
    return cell.owner !== EMPTY_OWNER && cell.count >= cell.capacity;
};
const coordinateOf = function (space) {
    return {
        column: space.column,
        row: space.row
    };
};
const boardSpaces = function (board) {
    return R.flatMap(function (row, rowIndex) {
        return R.map(function (cell, columnIndex) {
            return {
                cell,
                column: columnIndex,
                row: rowIndex
            };
        }, row);
    }, board);
};
const unstableTiles = function (board) {
    return R.pipe(
        boardSpaces,
        R.filter(function (space) {
            return unstable(space.cell);
        }),
        R.map(coordinateOf)
    )(board);
};
const snapshot = function (state) {
    return {
        board: copyBoard(state.board),
        currentPlayer: state.currentPlayer,
        difficulty: state.difficulty,
        lastMove: copyMove(state.lastMove),
        size: state.size,
        stats: copyStats(state.stats),
        status: state.status,
        turn: state.turn,
        turnsTaken: copyTurns(state.turnsTaken),
        winner: state.winner
    };
};
const normaliseState = function (state) {
    let history = [];
    if (state.history !== undefined) {
        history = state.history;
    }
    return freezeState(Object.assign({}, snapshot(state), {
        history: history.slice()
    }));
};
/**
 * Return the name used for a slime team in messages and labels.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.Player} player The player to name.
 * @returns {string} The display name for that player.
 */
function formatPlayer(player) {
    return PLAYER_NAMES[player];
}
/**
 * Turn row and column numbers into a pond label, such as A1.
 * @memberof SlimeReaction
 * @function
 * @param {number} row The zero-based row.
 * @param {number} column The zero-based column.
 * @returns {string} The label shown to the player.
 */
function formatCoordinate(row, column) {
    return `${String.fromCharCode(65 + column)}${row + 1}`;
}
const placementSummary = function (player, row, column, result) {
    const location = formatCoordinate(row, column);
    let plural = "s";
    if (result.explosions === 0) {
        return `${formatPlayer(player)} charged ${location}.`;
    }
    if (result.explosions === 1) {
        plural = "";
    }
    return (
        `${formatPlayer(player)} triggered ${result.explosions} explosion` +
        `${plural} from ${location}.`
    );
};
/**
 * Return the tiles touching a pond tile horizontally or vertically.
 * Diagonal tiles are not neighbours in Slime Reaction.
 * @memberof SlimeReaction
 * @function
 * @param {number} size The width and height of the square pond.
 * @param {number} row The zero-based row.
 * @param {number} column The zero-based column.
 * @returns {SlimeReaction.Coordinate[]} The neighbouring tile coordinates.
 */
function getAdjacentTiles(size, row, column) {
    return R.pipe(
        R.map(function (direction) {
            return {
                column: column + direction.column,
                row: row + direction.row
            };
        }),
        R.filter(function (coordinate) {
            return inBounds(size, coordinate.row, coordinate.column);
        })
    )(DIRECTIONS);
}
/**
 * Return how many slimes a tile can hold before it splits.
 * Corners hold 2, edges hold 3, and centre tiles hold 4.
 * @memberof SlimeReaction
 * @function
 * @param {number} size The width and height of the square pond.
 * @param {number} row The zero-based row.
 * @param {number} column The zero-based column.
 * @returns {number} The split capacity for that tile.
 */
function getTileCapacity(size, row, column) {
    return getAdjacentTiles(size, row, column).length;
}
/**
 * Create a new empty pond.
 * Every tile starts empty and gets the right split capacity for its position.
 * @memberof SlimeReaction
 * @function
 * @param {number} size The width and height of the square pond.
 * @returns {SlimeReaction.PondTile[][]} An empty pond for a new game.
 */
function createEmptyPond(size) {
    if (!validSize(size)) {
        throw new RangeError("Board size must be an integer from 3 to 10.");
    }
    return R.map(function (row) {
        return R.map(function (column) {
            return makeCell(EMPTY_OWNER, 0, getTileCapacity(size, row, column));
        }, R.range(0, size));
    }, R.range(0, size));
}
/**
 * Create a fresh game, with Blue ready to place the first slime.
 * If no options are given, the easy board is used.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameOptions} [options] The game setup.
 * @returns {SlimeReaction.GameState} The starting game state.
 */
function startNewGame(options = {}) {
    const difficulty = (
        options.difficulty === undefined
        ? DEFAULT_DIFFICULTY
        : options.difficulty
    );
    const size = (
        options.size === undefined
        ? DIFFICULTY_SIZES[difficulty]
        : options.size
    );
    if (!validDifficulty(difficulty) && options.size === undefined) {
        throw new RangeError("Difficulty must be easy, medium, or hard.");
    }
    if (!validSize(size)) {
        throw new RangeError("Board size must be an integer from 3 to 10.");
    }
    return freezeState({
        board: createEmptyPond(size),
        currentPlayer: BLUE,
        difficulty,
        history: [],
        lastMove: null,
        size,
        stats: blankStats(),
        status: "playing",
        turn: 1,
        turnsTaken: blankTurns(),
        winner: null
    });
}
/**
 * Start the same match setup again from an empty pond.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The current game state.
 * @returns {SlimeReaction.GameState} A fresh game with the same setup.
 */
function restartGame(state) {
    return startNewGame({difficulty: state.difficulty, size: state.size});
}
/**
 * Return a copy of the whole pond.
 * Changing the returned pond will not change the game state.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {SlimeReaction.PondTile[][]} A copy of the pond.
 */
function getPond(state) {
    return copyBoard(state.board);
}
/**
 * Return a copy of one pond tile.
 * If the coordinate is outside the pond, return null.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @param {number} row The zero-based row.
 * @param {number} column The zero-based column.
 * @returns {(SlimeReaction.PondTile | null)} A tile copy, or null.
 */
function getPondTile(state, row, column) {
    if (!inBounds(state.size, row, column)) {
        return null;
    }
    return copyCell(tileAt(state.board, row, column));
}
/**
 * Return the player who should make the next move.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {SlimeReaction.Player} The player to move.
 */
function getPlayerToMove(state) {
    return state.currentPlayer;
}
/**
 * Return whether the game is still being played or has been won.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {SlimeReaction.GameStatus} The current game status.
 */
function getGameStatus(state) {
    return state.status;
}
/**
 * Return the winner of the game.
 * While the game is still being played, return null.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {(SlimeReaction.Player | null)} The winner, or null.
 */
function getWinner(state) {
    return state.winner;
}
/**
 * Return the match statistics shown on the web page.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {object} The turn, explosion, chain, capture, and winner numbers.
 */
function getGameStats(state) {
    return copyStats(state.stats);
}
/**
 * Return a summary of the most recent legal placement.
 * This is useful for status text and sound effects in the interface.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {(object | null)} The last placement summary, or null.
 */
function getLastPlacement(state) {
    return copyMove(state.lastMove);
}
/**
 * Count how many tiles and slimes each player controls.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {{blue: SlimeReaction.Score, red: SlimeReaction.Score}} The two scores.
 */
function getTerritoryScores(state) {
    const score = function (player) {
        const tiles = R.filter(function (cell) {
            return cell.owner === player;
        }, state.board.flat());

        return {
            slimes: R.reduce(function (total, cell) {
                return total + cell.count;
            }, 0, tiles),
            tiles: tiles.length
        };
    };
    return {
        blue: score(BLUE),
        red: score(RED)
    };
}
/**
 * Return every tile where the current player can place a slime.
 * Empty tiles and that player's own tiles are legal.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to inspect.
 * @returns {SlimeReaction.Coordinate[]} The legal placement coordinates.
 */
function getPlayableTiles(state) {
    if (state.status !== "playing") {
        return [];
    }
    return R.pipe(
        boardSpaces,
        R.filter(function (space) {
            return (
                space.cell.owner === EMPTY_OWNER
                || space.cell.owner === state.currentPlayer
            );
        }),
        R.map(coordinateOf)
    )(state.board);
}
/**
 * Check whether the current player may place a slime on one tile.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to check.
 * @param {number} row The zero-based row.
 * @param {number} column The zero-based column.
 * @returns {boolean} Whether the placement is legal.
 */
function canPlaceSlime(state, row, column) {
    if (state.status !== "playing" || !inBounds(state.size, row, column)) {
        return false;
    }
    const cell = tileAt(state.board, row, column);
    return cell.owner === EMPTY_OWNER || cell.owner === state.currentPlayer;
}
const explodeTile = function (board, row, column) {
    const player = tileAt(board, row, column).owner;
    return R.reduce(function (result, neighbour) {
        const before = tileAt(result.board, neighbour.row, neighbour.column);
        const captured = before.owner !== EMPTY_OWNER && before.owner !== player;
        return {
            board: addSlime(result.board, neighbour.row, neighbour.column, player),
            tilesCaptured: result.tilesCaptured + Number(captured)
        };
    }, {
        board: resetTile(board, row, column),
        tilesCaptured: 0
    }, getAdjacentTiles(board.length, row, column));
};
function resolveChainReactions(initialBoard) {
    const maxExplosions = initialBoard.length * initialBoard.length * 24;
    const next = function (board, result) {
        const tile = unstableTiles(board)[0];
        if (tile === undefined) {
            return Object.assign({}, result, {
                board
            });
        }
        if (result.explosions >= maxExplosions) {
            return Object.assign({}, result, {
                board: R.map(function (row) {
                    return R.map(function (cell) {
                        if (!unstable(cell)) {
                            return copyCell(cell);
                        }
                        return makeCell(cell.owner, cell.capacity - 1, cell.capacity);
                    }, row);
                }, board)
            });
        }
        const owner = tileAt(board, tile.row, tile.column).owner;
        const exploded = explodeTile(board, tile.row, tile.column);
        return next(exploded.board, {
            explosions: result.explosions + 1,
            largestChainReaction: result.largestChainReaction + 1,
            sequence: result.sequence.concat([
                {
                    column: tile.column,
                    owner,
                    row: tile.row
                }
            ]),
            tilesCaptured: result.tilesCaptured + exploded.tilesCaptured
        });
    };
    return next(copyBoard(initialBoard), {
        board: copyBoard(initialBoard),
        explosions: 0,
        largestChainReaction: 0,
        sequence: [],
        tilesCaptured: 0
    });
}
const gameResult = function (state) {
    const bothMoved = R.every(function (player) {
        return state.turnsTaken[player] >= OPENING_TURNS;
    }, PLAYERS);
    const scores = getTerritoryScores(state);
    const loser = R.find(function (player) {
        return scores[player].tiles === 0;
    }, PLAYERS);
    if (!bothMoved || loser === undefined) {
        return {
            status: "playing",
            winner: null
        };
    }
    return {
        status: "won",
        winner: otherPlayer(loser)
    };
};
/**
 * Place a slime for the current player and resolve the whole chain reaction.
 * If the move is illegal, the same state is returned.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state before the move.
 * @param {number} row The zero-based row.
 * @param {number} column The zero-based column.
 * @returns {SlimeReaction.GameState} The next game state.
 */
function placeSlime(state, row, column) {
    if (!canPlaceSlime(state, row, column)) {
        return state;
    }
    const player = state.currentPlayer;
    const result = resolveChainReactions(addSlime(state.board, row, column, player));
    const turns = copyTurns(state.turnsTaken);
    turns[player] += 1;
    const next = {
        board: result.board,
        currentPlayer: otherPlayer(player),
        difficulty: state.difficulty,
        history: state.history.concat(JSON.stringify(snapshot(state))),
        lastMove: Object.assign({}, result, {
            column,
            player,
            row,
            summary: placementSummary(player, row, column, result)
        }),
        size: state.size,
        stats: {
            finalWinner: null,
            largestChainReaction: Math.max(
                state.stats.largestChainReaction,
                result.largestChainReaction
            ),
            tilesCaptured: state.stats.tilesCaptured + result.tilesCaptured,
            totalExplosions: state.stats.totalExplosions + result.explosions,
            totalTurns: state.stats.totalTurns + 1
        },
        status: "playing",
        turn: state.turn + 1,
        turnsTaken: turns,
        winner: null
    };
    const outcome = gameResult(next);
    return freezeState(Object.assign({}, next, {
        currentPlayer: (
            outcome.status === "won"
            ? player
            : next.currentPlayer
        ),
        stats: Object.assign({}, next.stats, {
            finalWinner: outcome.winner
        }),
        status: outcome.status,
        winner: outcome.winner
    }));
}
/**
 * Undo the most recent legal turn.
 * If there is no turn to undo, return the same state.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to undo from.
 * @returns {SlimeReaction.GameState} The previous game state.
 */
function undoLastTurn(state) {
    const previous = state.history.at(-1);
    if (previous === undefined) {
        return state;
    }
    return normaliseState(Object.assign({}, JSON.parse(previous), {
        history: state.history.slice(0, -1)
    }));
}
/**
 * Save a game state as JSON text.
 * @memberof SlimeReaction
 * @function
 * @param {SlimeReaction.GameState} state The game state to save.
 * @returns {string} The saved game data.
 */
function saveGame(state) {
    return JSON.stringify(Object.assign({}, snapshot(state), {
        history: state.history.slice()
    }));
}
/**
 * Load a saved game state.
 * The input may be JSON text or an already parsed object.
 * @memberof SlimeReaction
 * @function
 * @param {(string | object)} json The saved game data.
 * @returns {SlimeReaction.GameState} The loaded game state.
 */
function loadGame(json) {
    let parsed = json;
    if (typeof json === "string") {
        parsed = JSON.parse(json);
    }
    return normaliseState(parsed);
}
const SlimeReaction = {
    BLUE,
    RED,
    canPlaceSlime,
    createEmptyPond,
    formatCoordinate,
    formatPlayer,
    getAdjacentTiles,
    getGameStats,
    getGameStatus,
    getLastPlacement,
    getPlayableTiles,
    getPlayerToMove,
    getPond,
    getPondTile,
    getTerritoryScores,
    getTileCapacity,
    getWinner,
    loadGame,
    placeSlime,
    restartGame,
    saveGame,
    startNewGame,
    undoLastTurn
};
export default Object.freeze(SlimeReaction);
