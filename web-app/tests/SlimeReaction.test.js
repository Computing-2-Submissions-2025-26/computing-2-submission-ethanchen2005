import test from "node:test";
import assert from "node:assert/strict";
import SlimeReaction from "../SlimeReaction.js";

const {
    BLUE,
    RED,
    applyAction,
    applyMove,
    calculateScores,
    createBoard,
    createGame,
    deserializeGame,
    getBoard,
    getCell,
    getCurrentPlayer,
    getLegalMoves,
    getStats,
    getStatus,
    getWinner,
    isMoveLegal,
    serializeGame,
    undo
} = SlimeReaction;

const emptyState = function (overrides = {}) {
    const size = overrides.size ?? 3;

    return {
        difficulty: overrides.difficulty ?? "easy",
        size,
        board: overrides.board ?? createBoard(size),
        currentPlayer: overrides.currentPlayer ?? BLUE,
        turn: overrides.turn ?? 1,
        turnsTaken: overrides.turnsTaken ?? {
            [BLUE]: 0,
            [RED]: 0
        },
        status: overrides.status ?? "playing",
        winner: overrides.winner ?? null,
        stats: overrides.stats ?? {
            totalTurns: 0,
            totalExplosions: 0,
            largestChainReaction: 0,
            cellsCaptured: 0,
            finalWinner: null
        },
        lastMove: overrides.lastMove ?? null,
        history: overrides.history ?? []
    };
};

const withCell = function (board, row, column, owner, count) {
    return board.map(function (boardRow, rowIndex) {
        return boardRow.map(function (cell, columnIndex) {
            if (rowIndex !== row || columnIndex !== column) {
                return {
                    ...cell
                };
            }

            return {
                ...cell,
                owner,
                count
            };
        });
    });
};

const stateWithBoard = function (board, overrides = {}) {
    return deserializeGame(emptyState({
        ...overrides,
        size: board.length,
        board
    }));
};

test("given a new easy game, when inspected, then it is an empty 6 by 6 board with Blue first", function () {
    const state = createGame({ difficulty: "easy" });
    const board = getBoard(state);

    assert.equal(board.length, 6, "easy board should have six rows");
    assert.deepEqual(
        board.map(function (row) {
            return row.length;
        }),
        [6, 6, 6, 6, 6, 6],
        "easy board should have six cells in every row"
    );
    assert.equal(getCurrentPlayer(state), BLUE, "Blue should take the first turn");
    assert.equal(getStatus(state), "playing", "new game should start in playing state");
    assert.equal(getCell(state, 0, 0).capacity, 2, "corner capacity should be two");
    assert.equal(getCell(state, 0, 2).capacity, 3, "edge capacity should be three");
    assert.equal(getCell(state, 2, 2).capacity, 4, "centre capacity should be four");
});

test("given difficulty options, when games are created, then board sizes match the brief", function () {
    assert.equal(createGame({ difficulty: "easy" }).size, 6, "easy should be 6 by 6");
    assert.equal(createGame({ difficulty: "medium" }).size, 8, "medium should be 8 by 8");
    assert.equal(createGame({ difficulty: "hard" }).size, 10, "hard should be 10 by 10");
});

test("given legal targets, when inspected, then empty and own cells are legal but opponent cells are not", function () {
    const afterBlue = applyMove(createGame({ size: 3 }), 0, 0);

    assert.equal(isMoveLegal(afterBlue, 0, 1), true, "Red may place into an empty cell");
    assert.equal(isMoveLegal(afterBlue, 0, 0), false, "Red may not place into Blue's cell");

    const afterRed = applyMove(afterBlue, 0, 1);

    assert.equal(isMoveLegal(afterRed, 0, 0), true, "Blue may place into Blue's own cell");
    assert.equal(
        getLegalMoves(afterRed).some(function (move) {
            return move.row === 0 && move.column === 1;
        }),
        false,
        "Blue should not see Red's cell as a legal target"
    );
});

test("given an opponent cell, when action is applied there, then state and turn are unchanged", function () {
    const afterBlue = applyMove(createGame({ size: 3 }), 0, 0);
    const afterIllegal = applyAction(afterBlue, {
        type: "placeOrb",
        row: 0,
        column: 0
    });

    assert.equal(afterIllegal, afterBlue, "illegal actions should return the original state");
    assert.equal(getCurrentPlayer(afterIllegal), RED, "turn should not advance after illegal action");
    assert.equal(getCell(afterIllegal, 0, 0).owner, BLUE, "opponent cell should not change owner");
});

test("given a legal move, when applied, then the new state changes and the old state remains unchanged", function () {
    const before = createGame({ size: 3 });
    const after = applyMove(before, 1, 1);

    assert.notEqual(after, before, "legal move should return a new state object");
    assert.equal(getCell(after, 1, 1).owner, BLUE, "new state should contain the placed orb");
    assert.equal(getCell(after, 1, 1).count, 1, "new state should increase orb count");
    assert.equal(getCell(before, 1, 1).owner, null, "previous state should remain empty");
});

test("given a charged corner, when it reaches capacity, then it explodes to its two neighbours", function () {
    const board = withCell(createBoard(3), 0, 0, BLUE, 1);
    const state = stateWithBoard(board, {
        currentPlayer: BLUE
    });
    const after = applyMove(state, 0, 0);

    assert.equal(getCell(after, 0, 0).owner, null, "exploded corner should become empty");
    assert.equal(getCell(after, 0, 0).count, 0, "exploded corner should lose all energy");
    assert.equal(getCell(after, 0, 1).owner, BLUE, "right neighbour should receive Blue energy");
    assert.equal(getCell(after, 1, 0).owner, BLUE, "down neighbour should receive Blue energy");
    assert.equal(getStats(after).totalExplosions, 1, "one explosion should be recorded");
});

test("given an enemy beside an explosion, when energy enters it, then ownership converts", function () {
    const board = withCell(
        withCell(createBoard(3), 0, 0, BLUE, 1),
        0,
        1,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            [BLUE]: 1,
            [RED]: 1
        }
    });
    const after = applyMove(state, 0, 0);

    assert.equal(getCell(after, 0, 1).owner, BLUE, "enemy cell should convert to Blue");
    assert.equal(getCell(after, 0, 1).count, 2, "converted cell should retain and add energy");
    assert.equal(getStats(after).cellsCaptured, 1, "conversion should be counted as a capture");
});

test("given an explosion creates another critical cell, when resolved, then the full chain completes", function () {
    const board = withCell(
        withCell(createBoard(3), 0, 0, BLUE, 1),
        0,
        1,
        BLUE,
        2
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE
    });
    const after = applyMove(state, 0, 0);

    assert.equal(getCell(after, 0, 1).owner, null, "second exploding cell should also empty");
    assert.equal(getCell(after, 0, 2).owner, BLUE, "chain should distribute to the far edge");
    assert.equal(getCell(after, 1, 1).owner, BLUE, "chain should distribute downwards");
    assert.equal(getStats(after).totalExplosions, 2, "two explosions should be recorded");
    assert.equal(getStats(after).largestChainReaction, 2, "largest chain should be two");
});

test("given Blue has moved first, when Red has zero cells, then opening protection prevents victory", function () {
    const afterBlue = applyMove(createGame({ size: 3 }), 0, 0);

    assert.equal(getStatus(afterBlue), "playing", "game should continue before Red has moved");
    assert.equal(getWinner(afterBlue), null, "no winner should be declared in the opening phase");
});

test("given both players have moved, when Red is eliminated, then Blue wins", function () {
    const board = withCell(
        withCell(createBoard(3), 0, 0, BLUE, 1),
        0,
        1,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            [BLUE]: 1,
            [RED]: 1
        }
    });
    const after = applyMove(state, 0, 0);

    assert.equal(getStatus(after), "won", "game should enter won state");
    assert.equal(getWinner(after), BLUE, "Blue should win after Red has zero cells");
});

test("given a move with explosions and captures, when complete, then statistics update", function () {
    const board = withCell(
        withCell(createBoard(3), 0, 0, BLUE, 1),
        1,
        0,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            [BLUE]: 1,
            [RED]: 1
        }
    });
    const after = applyMove(state, 0, 0);
    const stats = getStats(after);

    assert.equal(stats.totalTurns, 1, "one legal turn should be recorded from the fixture");
    assert.equal(stats.totalExplosions, 1, "one explosion should be counted");
    assert.equal(stats.largestChainReaction, 1, "largest chain should record the move chain length");
    assert.equal(stats.cellsCaptured, 1, "one captured cell should be counted");
});

test("given a previous state exists, when undo is requested, then that state is restored", function () {
    const before = createGame({ size: 3 });
    const after = applyMove(before, 2, 2);
    const restored = undo(after);

    assert.deepEqual(getBoard(restored), getBoard(before), "undo should restore the previous board");
    assert.equal(getCurrentPlayer(restored), getCurrentPlayer(before), "undo should restore current player");
    assert.equal(restored.turn, before.turn, "undo should restore turn number");
});

test("given many turns, when history is inspected and undone, then snapshots stay compact and support repeated undo", function () {
    const played = Array.from({ length: 18 }).reduce(function (state) {
        const move = getLegalMoves(state).find(function (candidate) {
            return getCell(state, candidate.row, candidate.column).owner === null;
        });

        return applyMove(state, move.row, move.column);
    }, createGame({ difficulty: "easy" }));
    const firstUndo = undo(played);
    const secondUndo = undo(firstUndo);

    assert.equal(played.history.length, 18, "one compact snapshot should be stored per legal turn");
    assert.equal(
        played.history.every(function (snapshot) {
            return JSON.parse(snapshot).history === undefined;
        }),
        true,
        "history snapshots should not recursively contain prior history"
    );
    assert.equal(firstUndo.turn, played.turn - 1, "first undo should restore the previous turn");
    assert.equal(secondUndo.turn, played.turn - 2, "second undo should still be available");
});

test("given a game state, when serialized and loaded, then public state is preserved", function () {
    const played = applyMove(applyMove(createGame({ size: 3 }), 0, 0), 0, 1);
    const loaded = deserializeGame(serializeGame(played));

    assert.deepEqual(getBoard(loaded), getBoard(played), "loaded board should match saved board");
    assert.equal(getCurrentPlayer(loaded), getCurrentPlayer(played), "loaded current player should match");
    assert.equal(getStatus(loaded), getStatus(played), "loaded status should match");
    assert.deepEqual(calculateScores(loaded), calculateScores(played), "loaded scores should match");
    assert.deepEqual(getStats(loaded), getStats(played), "loaded stats should match");
});
