/**
 * Pure game logic for Slime Reaction.
 *
 * The module is the functional core of the coursework web app. It models a
 * turn-based board game as immutable state values and exposes domain-focused
 * query and transition functions for the UI and tests.
 *
 * @module SlimeReaction
 */
"use strict";

/**
 * @typedef {"blue" | "red"} Player
 */

/**
 * @typedef {"easy" | "medium" | "hard"} Difficulty
 */

/**
 * @typedef {"playing" | "won"} GameStatus
 */

/**
 * @typedef {object} Cell
 * @property {Player | null} owner Player controlling the cell.
 * @property {number} count Orb count in the cell.
 * @property {number} capacity Number of neighbours needed to explode.
 */

/**
 * @typedef {object} Coordinate
 * @property {number} row Zero-based board row.
 * @property {number} column Zero-based board column.
 */

/**
 * @typedef {object} Action
 * @property {"placeOrb"} type Domain action type.
 * @property {number} row Zero-based board row.
 * @property {number} column Zero-based board column.
 */

/**
 * @typedef {object} GameStats
 * @property {number} totalTurns Number of legal turns completed.
 * @property {number} totalExplosions Total explosions across the game.
 * @property {number} largestChainReaction Largest explosion chain in one move.
 * @property {number} cellsCaptured Opponent cell conversions caused by explosions.
 * @property {Player | null} finalWinner Winner after the game ends.
 */

export const BLUE = "blue";
export const RED = "red";
export const PLAYERS = Object.freeze([BLUE, RED]);
export const EMPTY_OWNER = null;
export const DEFAULT_DIFFICULTY = "easy";
export const DIFFICULTY_SIZES = Object.freeze({
    easy: 6,
    medium: 8,
    hard: 10
});

const MIN_CUSTOM_SIZE = 3;
const MAX_CUSTOM_SIZE = 10;
const OPENING_TURN_REQUIREMENT = 1;

const ORTHOGONAL_DIRECTIONS = Object.freeze([
    Object.freeze({ row: -1, column: 0 }),
    Object.freeze({ row: 1, column: 0 }),
    Object.freeze({ row: 0, column: -1 }),
    Object.freeze({ row: 0, column: 1 })
]);

const range = function (length) {
    return Array.from({ length }, function (_, index) {
        return index;
    });
};

const copyCell = function (cell) {
    return {
        owner: cell.owner,
        count: cell.count,
        capacity: cell.capacity
    };
};

const copyBoard = function (board) {
    return board.map(function (row) {
        return row.map(copyCell);
    });
};

const copyTurnsTaken = function (turnsTaken) {
    return {
        [BLUE]: turnsTaken[BLUE],
        [RED]: turnsTaken[RED]
    };
};

const copyStats = function (stats) {
    return {
        totalTurns: stats.totalTurns,
        totalExplosions: stats.totalExplosions,
        largestChainReaction: stats.largestChainReaction,
        cellsCaptured: stats.cellsCaptured,
        finalWinner: stats.finalWinner
    };
};

const copyCoordinate = function (coordinate) {
    return {
        row: coordinate.row,
        column: coordinate.column
    };
};

const copySequenceItem = function (item) {
    return Object.freeze({
        row: item.row,
        column: item.column,
        owner: item.owner
    });
};

const copyLastMove = function (lastMove) {
    if (lastMove === null) {
        return null;
    }

    return {
        player: lastMove.player,
        row: lastMove.row,
        column: lastMove.column,
        explosions: lastMove.explosions,
        largestChainReaction: lastMove.largestChainReaction,
        cellsCaptured: lastMove.cellsCaptured,
        sequence: lastMove.sequence.map(function (item) {
            return {
                row: item.row,
                column: item.column,
                owner: item.owner
            };
        }),
        summary: lastMove.summary
    };
};

const freezeBoard = function (board) {
    return Object.freeze(
        board.map(function (row) {
            return Object.freeze(
                row.map(function (cell) {
                    return Object.freeze(copyCell(cell));
                })
            );
        })
    );
};

const freezeLastMove = function (lastMove) {
    if (lastMove === null) {
        return null;
    }

    return Object.freeze({
        player: lastMove.player,
        row: lastMove.row,
        column: lastMove.column,
        explosions: lastMove.explosions,
        largestChainReaction: lastMove.largestChainReaction,
        cellsCaptured: lastMove.cellsCaptured,
        sequence: Object.freeze(lastMove.sequence.map(copySequenceItem)),
        summary: lastMove.summary
    });
};

const freezeState = function (state) {
    return Object.freeze({
        difficulty: state.difficulty,
        size: state.size,
        board: freezeBoard(state.board),
        currentPlayer: state.currentPlayer,
        turn: state.turn,
        turnsTaken: Object.freeze(copyTurnsTaken(state.turnsTaken)),
        status: state.status,
        winner: state.winner,
        stats: Object.freeze(copyStats(state.stats)),
        lastMove: freezeLastMove(state.lastMove),
        history: Object.freeze(state.history.slice())
    });
};

const isPlayer = function (player) {
    return PLAYERS.includes(player);
};

const otherPlayer = function (player) {
    return player === BLUE ? RED : BLUE;
};

const isValidDifficulty = function (difficulty) {
    return Object.hasOwn(DIFFICULTY_SIZES, difficulty);
};

const isValidSize = function (size) {
    return (
        Number.isInteger(size)
        && size >= MIN_CUSTOM_SIZE
        && size <= MAX_CUSTOM_SIZE
    );
};

const isCoordinateValue = function (value) {
    return Number.isInteger(value);
};

const isInBounds = function (size, row, column) {
    return (
        isCoordinateValue(row)
        && isCoordinateValue(column)
        && row >= 0
        && row < size
        && column >= 0
        && column < size
    );
};

const makeCell = function (owner, count, capacity) {
    return {
        owner,
        count,
        capacity
    };
};

const emptyCell = function (size, row, column) {
    return makeCell(EMPTY_OWNER, 0, determineCellCapacity(size, row, column));
};

const setCell = function (board, row, column, cell) {
    return board.map(function (boardRow, rowIndex) {
        if (rowIndex !== row) {
            return boardRow.map(copyCell);
        }

        return boardRow.map(function (existingCell, columnIndex) {
            return columnIndex === column ? copyCell(cell) : copyCell(existingCell);
        });
    });
};

const cellAt = function (board, row, column) {
    return board[row][column];
};

const makeStats = function () {
    return {
        totalTurns: 0,
        totalExplosions: 0,
        largestChainReaction: 0,
        cellsCaptured: 0,
        finalWinner: null
    };
};

const makeTurnsTaken = function () {
    return {
        [BLUE]: 0,
        [RED]: 0
    };
};

const countCellsFor = function (board, player) {
    return board.flat().filter(function (cell) {
        return cell.owner === player;
    }).length;
};

const isUnstable = function (cell) {
    return cell.owner !== EMPTY_OWNER && cell.count >= cell.capacity;
};

const findUnstableCells = function (board) {
    return board.flatMap(function (row, rowIndex) {
        return row.map(function (cell, columnIndex) {
            return {
                row: rowIndex,
                column: columnIndex,
                cell
            };
        }).filter(function (space) {
            return isUnstable(space.cell);
        }).map(function (space) {
            return {
                row: space.row,
                column: space.column
            };
        });
    });
};

const addOrbToCell = function (board, row, column, player) {
    const cell = cellAt(board, row, column);

    return setCell(
        board,
        row,
        column,
        makeCell(player, cell.count + 1, cell.capacity)
    );
};

const resetExplodedCell = function (board, row, column) {
    const cell = cellAt(board, row, column);

    return setCell(
        board,
        row,
        column,
        makeCell(EMPTY_OWNER, 0, cell.capacity)
    );
};

const explodeCell = function (board, row, column) {
    const explodingCell = cellAt(board, row, column);
    const explodingPlayer = explodingCell.owner;
    const neighbours = getNeighbours(board.length, row, column);

    return neighbours.reduce(function (result, neighbour) {
        const before = cellAt(result.board, neighbour.row, neighbour.column);
        const captured = (
            before.owner !== EMPTY_OWNER
            && before.owner !== explodingPlayer
        );

        return {
            board: addOrbToCell(
                result.board,
                neighbour.row,
                neighbour.column,
                explodingPlayer
            ),
            cellsCaptured: result.cellsCaptured + (captured ? 1 : 0)
        };
    }, {
        board: resetExplodedCell(board, row, column),
        cellsCaptured: 0
    });
};

const withWinnerApplied = function (state, winner) {
    const won = winner !== null;

    return {
        ...state,
        status: won ? "won" : "playing",
        winner,
        stats: {
            ...state.stats,
            finalWinner: winner
        }
    };
};

const stateSnapshot = function (state) {
    return {
        difficulty: state.difficulty,
        size: state.size,
        board: copyBoard(state.board),
        currentPlayer: state.currentPlayer,
        turn: state.turn,
        turnsTaken: copyTurnsTaken(state.turnsTaken),
        status: state.status,
        winner: state.winner,
        stats: copyStats(state.stats),
        lastMove: copyLastMove(state.lastMove)
    };
};

const stateForHistory = function (state) {
    return JSON.stringify(stateSnapshot(state));
};

const stateForSave = function (state) {
    return JSON.stringify({
        ...stateSnapshot(state),
        history: state.history.slice()
    });
};

const normaliseState = function (state) {
    return freezeState({
        difficulty: state.difficulty ?? DEFAULT_DIFFICULTY,
        size: state.size,
        board: copyBoard(state.board),
        currentPlayer: state.currentPlayer,
        turn: state.turn,
        turnsTaken: copyTurnsTaken(state.turnsTaken),
        status: state.status,
        winner: state.winner,
        stats: copyStats(state.stats),
        lastMove: copyLastMove(state.lastMove),
        history: (state.history ?? []).slice()
    });
};

const actionSummary = function (player, row, column, resolution) {
    const location = formatCoordinate(row, column);

    if (resolution.explosions === 0) {
        return `${formatPlayer(player)} charged ${location}.`;
    }

    return `${formatPlayer(player)} triggered ${resolution.explosions} explosion${resolution.explosions === 1 ? "" : "s"} from ${location}.`;
};

/**
 * Convert a player id into display text.
 *
 * @param {Player} player Player id.
 * @returns {string} Display label.
 */
export function formatPlayer(player) {
    return player === BLUE ? "Blue" : "Red";
}

/**
 * Convert a coordinate into a board label.
 *
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {string} Human-readable coordinate.
 */
export function formatCoordinate(row, column) {
    return `${String.fromCharCode(65 + column)}${row + 1}`;
}

/**
 * Determine a cell's critical mass from its orthogonal neighbour count.
 *
 * @param {number} size Board width and height.
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {number} Capacity: 2 for corners, 3 for edges, 4 for centre cells.
 */
export function determineCellCapacity(size, row, column) {
    return ORTHOGONAL_DIRECTIONS.filter(function (direction) {
        return isInBounds(size, row + direction.row, column + direction.column);
    }).length;
}

/**
 * Get orthogonal neighbours for a board position.
 *
 * @param {number} size Board width and height.
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {Coordinate[]} Neighbour coordinates.
 */
export function getNeighbours(size, row, column) {
    return ORTHOGONAL_DIRECTIONS.map(function (direction) {
        return {
            row: row + direction.row,
            column: column + direction.column
        };
    }).filter(function (coordinate) {
        return isInBounds(size, coordinate.row, coordinate.column);
    });
}

/**
 * Create an empty board with capacity embedded in every cell.
 *
 * @param {number} size Board width and height.
 * @returns {Cell[][]} Empty board.
 */
export function createBoard(size) {
    if (!isValidSize(size)) {
        throw new RangeError("Board size must be an integer from 3 to 10.");
    }

    return range(size).map(function (row) {
        return range(size).map(function (column) {
            return emptyCell(size, row, column);
        });
    });
}

/**
 * Create a new game.
 *
 * @param {{ difficulty?: Difficulty, size?: number }} [options] Game options.
 * @returns {Readonly<object>} Immutable game state.
 */
export function createGame(options = {}) {
    const difficulty = options.difficulty ?? DEFAULT_DIFFICULTY;
    const size = options.size ?? DIFFICULTY_SIZES[difficulty];

    if (!isValidDifficulty(difficulty) && options.size === undefined) {
        throw new RangeError("Difficulty must be easy, medium, or hard.");
    }

    if (!isValidSize(size)) {
        throw new RangeError("Board size must be an integer from 3 to 10.");
    }

    return freezeState({
        difficulty,
        size,
        board: createBoard(size),
        currentPlayer: BLUE,
        turn: 1,
        turnsTaken: makeTurnsTaken(),
        status: "playing",
        winner: null,
        stats: makeStats(),
        lastMove: null,
        history: []
    });
}

/**
 * Start a new game using the same options as an existing state.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Readonly<object>} Fresh game state.
 */
export function restart(state) {
    return createGame({
        difficulty: state.difficulty,
        size: state.size
    });
}

/**
 * Return a defensive copy of the board.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Cell[][]} Board copy.
 */
export function getBoard(state) {
    return copyBoard(state.board);
}

/**
 * Return one cell, or null when out of bounds.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {Cell | null} Cell copy.
 */
export function getCell(state, row, column) {
    if (!isInBounds(state.size, row, column)) {
        return null;
    }

    return copyCell(cellAt(state.board, row, column));
}

/**
 * Alias for cell inspection, matching tile-oriented coursework language.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {string} tileId Tile id in "row:column" form.
 * @returns {Cell | null} Cell copy.
 */
export function getTile(state, tileId) {
    const parts = String(tileId).split(":").map(Number);

    if (parts.length !== 2) {
        return null;
    }

    return getCell(state, parts[0], parts[1]);
}

/**
 * Return the board for display or tests.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Cell[][]} Board copy.
 */
export function getBoardCells(state) {
    return getBoard(state);
}

/**
 * Get the current player.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Player} Current player.
 */
export function getCurrentPlayer(state) {
    return state.currentPlayer;
}

/**
 * Get the game status.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {GameStatus} Status.
 */
export function getStatus(state) {
    return state.status;
}

/**
 * Get the winner after a terminal game.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Player | null} Winning player or null.
 */
export function getWinner(state) {
    return state.winner;
}

/**
 * Get tracked game statistics.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {GameStats} Stats copy.
 */
export function getStats(state) {
    return copyStats(state.stats);
}

/**
 * Get the most recent legal move.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {object | null} Last move copy.
 */
export function getLastMove(state) {
    return copyLastMove(state.lastMove);
}

/**
 * Determine which player controls a cell.
 *
 * @param {Cell} cell Board cell.
 * @returns {Player | null} Controller.
 */
export function determineTileController(cell) {
    return cell.owner;
}

/**
 * Calculate controlled cells and orb totals for both players.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {{ blue: { cells: number, orbs: number }, red: { cells: number, orbs: number } }} Scores.
 */
export function calculateScores(state) {
    return PLAYERS.reduce(function (scores, player) {
        const ownedCells = state.board.flat().filter(function (cell) {
            return cell.owner === player;
        });

        return {
            ...scores,
            [player]: {
                cells: ownedCells.length,
                orbs: ownedCells.reduce(function (total, cell) {
                    return total + cell.count;
                }, 0)
            }
        };
    }, {});
}

/**
 * Return cells controlled by a player.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {Player} player Player id.
 * @returns {Coordinate[]} Controlled coordinates.
 */
export function getControlledTiles(state, player) {
    if (!isPlayer(player)) {
        return [];
    }

    return state.board.flatMap(function (row, rowIndex) {
        return row.map(function (cell, columnIndex) {
            return {
                row: rowIndex,
                column: columnIndex,
                owner: cell.owner
            };
        }).filter(function (space) {
            return space.owner === player;
        }).map(function (space) {
            return {
                row: space.row,
                column: space.column
            };
        });
    });
}

/**
 * Return all legal target cells for the current player.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Coordinate[]} Legal move coordinates.
 */
export function getLegalMoves(state) {
    if (state.status !== "playing") {
        return [];
    }

    return state.board.flatMap(function (row, rowIndex) {
        return row.map(function (cell, columnIndex) {
            return {
                row: rowIndex,
                column: columnIndex,
                owner: cell.owner
            };
        }).filter(function (space) {
            return (
                space.owner === EMPTY_OWNER
                || space.owner === state.currentPlayer
            );
        }).map(function (space) {
            return {
                row: space.row,
                column: space.column
            };
        });
    });
}

/**
 * Return available domain actions.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {{ type: "placeOrb", player: Player }[]} Valid action types.
 */
export function getValidActions(state) {
    if (state.status !== "playing") {
        return [];
    }

    return [
        {
            type: "placeOrb",
            player: state.currentPlayer
        }
    ];
}

/**
 * Return legal targets for a domain action.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {"placeOrb"} actionType Action type.
 * @returns {Coordinate[]} Valid targets.
 */
export function getValidTargets(state, actionType = "placeOrb") {
    if (actionType !== "placeOrb") {
        return [];
    }

    return getLegalMoves(state);
}

/**
 * Decide whether the current player may place an orb at a cell.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {boolean} True when legal.
 */
export function isMoveLegal(state, row, column) {
    if (state.status !== "playing") {
        return false;
    }

    if (!isInBounds(state.size, row, column)) {
        return false;
    }

    const cell = cellAt(state.board, row, column);

    return cell.owner === EMPTY_OWNER || cell.owner === state.currentPlayer;
}

/**
 * Decide whether an action can be applied.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {Action} action Candidate action.
 * @returns {boolean} True when legal.
 */
export function canApplyAction(state, action) {
    return (
        action !== null
        && action !== undefined
        && action.type === "placeOrb"
        && isMoveLegal(state, action.row, action.column)
    );
}

/**
 * Resolve all explosions until the board stabilises.
 *
 * @param {Cell[][]} initialBoard Board after the placed orb.
 * @returns {{ board: Cell[][], explosions: number, largestChainReaction: number, cellsCaptured: number, sequence: object[] }}
 * Resolution result.
 */
export function resolveChainReactions(initialBoard) {
    const maxExplosions = initialBoard.length * initialBoard.length * 24;

    const resolveNext = function (board, result) {
        const unstable = findUnstableCells(board)[0];

        if (unstable === undefined) {
            return {
                ...result,
                board
            };
        }

        if (result.explosions >= maxExplosions) {
            return {
                ...result,
                board: board.map(function (row) {
                    return row.map(function (cell) {
                        if (!isUnstable(cell)) {
                            return copyCell(cell);
                        }

                        return makeCell(cell.owner, cell.capacity - 1, cell.capacity);
                    });
                })
            };
        }

        const owner = cellAt(board, unstable.row, unstable.column).owner;
        const exploded = explodeCell(board, unstable.row, unstable.column);

        return resolveNext(exploded.board, {
            explosions: result.explosions + 1,
            largestChainReaction: result.largestChainReaction + 1,
            cellsCaptured: result.cellsCaptured + exploded.cellsCaptured,
            sequence: result.sequence.concat([
                {
                    row: unstable.row,
                    column: unstable.column,
                    owner
                }
            ])
        });
    };

    return resolveNext(copyBoard(initialBoard), {
        board: copyBoard(initialBoard),
        explosions: 0,
        largestChainReaction: 0,
        cellsCaptured: 0,
        sequence: []
    });
}

/**
 * Check whether the game has a winner.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {{ status: GameStatus, winner: Player | null }} Status result.
 */
export function checkGameStatus(state) {
    const bothPlayersHaveMoved = PLAYERS.every(function (player) {
        return state.turnsTaken[player] >= OPENING_TURN_REQUIREMENT;
    });

    if (!bothPlayersHaveMoved) {
        return {
            status: "playing",
            winner: null
        };
    }

    const scores = calculateScores(state);
    const eliminated = PLAYERS.find(function (player) {
        return scores[player].cells === 0;
    });

    if (eliminated === undefined) {
        return {
            status: "playing",
            winner: null
        };
    }

    return {
        status: "won",
        winner: otherPlayer(eliminated)
    };
}

/**
 * Apply a typed action.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {Action} action Action to apply.
 * @returns {Readonly<object>} Next immutable state, or the same state if illegal.
 */
export function applyAction(state, action) {
    if (!canApplyAction(state, action)) {
        return state;
    }

    return applyMove(state, action.row, action.column);
}

/**
 * Place an orb for the current player and resolve all chain reactions.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {Readonly<object>} Next immutable game state, or the same state if illegal.
 */
export function applyMove(state, row, column) {
    if (!isMoveLegal(state, row, column)) {
        return state;
    }

    const player = state.currentPlayer;
    const boardAfterPlacement = addOrbToCell(state.board, row, column, player);
    const resolution = resolveChainReactions(boardAfterPlacement);
    const turnsTaken = {
        ...state.turnsTaken,
        [player]: state.turnsTaken[player] + 1
    };
    const baseNextState = {
        difficulty: state.difficulty,
        size: state.size,
        board: resolution.board,
        currentPlayer: otherPlayer(player),
        turn: state.turn + 1,
        turnsTaken,
        status: "playing",
        winner: null,
        stats: {
            totalTurns: state.stats.totalTurns + 1,
            totalExplosions: state.stats.totalExplosions + resolution.explosions,
            largestChainReaction: Math.max(
                state.stats.largestChainReaction,
                resolution.largestChainReaction
            ),
            cellsCaptured: state.stats.cellsCaptured + resolution.cellsCaptured,
            finalWinner: null
        },
        lastMove: {
            player,
            row,
            column,
            explosions: resolution.explosions,
            largestChainReaction: resolution.largestChainReaction,
            cellsCaptured: resolution.cellsCaptured,
            sequence: resolution.sequence,
            summary: actionSummary(player, row, column, resolution)
        },
        history: state.history.concat([stateForHistory(state)])
    };
    const status = checkGameStatus(baseNextState);
    const winnerState = withWinnerApplied(baseNextState, status.winner);

    return freezeState({
        ...winnerState,
        currentPlayer: status.status === "playing" ? winnerState.currentPlayer : player
    });
}

/**
 * Alias for course-style action naming.
 *
 * @param {Readonly<object>} state Current game state.
 * @param {number} row Zero-based row.
 * @param {number} column Zero-based column.
 * @returns {Readonly<object>} Next immutable state.
 */
export function placeOrb(state, row, column) {
    return applyMove(state, row, column);
}

/**
 * Undo the most recent legal turn.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {Readonly<object>} Previous immutable state, or the same state.
 */
export function undo(state) {
    const previous = state.history.at(-1);

    if (previous === undefined) {
        return state;
    }

    return normaliseState({
        ...JSON.parse(previous),
        history: state.history.slice(0, -1)
    });
}

/**
 * Serialize a game state for save/load.
 *
 * @param {Readonly<object>} state Current game state.
 * @returns {string} JSON save data.
 */
export function serializeGame(state) {
    return stateForSave(state);
}

/**
 * Deserialize a saved game.
 *
 * @param {string | object} json JSON string or parsed object.
 * @returns {Readonly<object>} Immutable game state.
 */
export function deserializeGame(json) {
    const parsed = typeof json === "string" ? JSON.parse(json) : json;

    return normaliseState(parsed);
}

const SlimeReaction = Object.freeze({
    BLUE,
    RED,
    PLAYERS,
    EMPTY_OWNER,
    DEFAULT_DIFFICULTY,
    DIFFICULTY_SIZES,
    formatPlayer,
    formatCoordinate,
    determineCellCapacity,
    getNeighbours,
    createBoard,
    createGame,
    restart,
    getBoard,
    getCell,
    getTile,
    getBoardCells,
    getCurrentPlayer,
    getStatus,
    getWinner,
    getStats,
    getLastMove,
    determineTileController,
    calculateScores,
    getControlledTiles,
    getLegalMoves,
    getValidActions,
    getValidTargets,
    isMoveLegal,
    canApplyAction,
    resolveChainReactions,
    checkGameStatus,
    applyAction,
    applyMove,
    placeOrb,
    undo,
    serializeGame,
    deserializeGame
});

export default SlimeReaction;
