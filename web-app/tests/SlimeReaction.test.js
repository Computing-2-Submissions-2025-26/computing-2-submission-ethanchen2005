/*jslint long, node, white*/
import test from "node:test";
import assert from "node:assert/strict";
import SlimeReaction from "../SlimeReaction.js";

const {
    BLUE,
    RED,
    placeSlime,
    getTerritoryScores,
    createEmptyPond,
    startNewGame,
    loadGame,
    getPond,
    getPondTile,
    getPlayerToMove,
    getPlayableTiles,
    getGameStats,
    getGameStatus,
    getLastPlacement,
    getWinner,
    canPlaceSlime,
    saveGame,
    undoLastTurn
} = SlimeReaction;

const fallback = function (value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }

    return value;
};

const emptyState = function (overrides = {}) {
    const size = fallback(overrides.size, 3);

    return {
        difficulty: fallback(overrides.difficulty, "easy"),
        size,
        board: fallback(overrides.board, createEmptyPond(size)),
        currentPlayer: fallback(overrides.currentPlayer, BLUE),
        turn: fallback(overrides.turn, 1),
        turnsTaken: fallback(overrides.turnsTaken, {
            blue: 0,
            red: 0
        }),
        status: fallback(overrides.status, "playing"),
        winner: fallback(overrides.winner, null),
        stats: fallback(overrides.stats, {
            finalWinner: null,
            largestChainReaction: 0,
            tilesCaptured: 0,
            totalExplosions: 0,
            totalTurns: 0
        }),
        lastMove: fallback(overrides.lastMove, null),
        history: fallback(overrides.history, [])
    };
};

const copyTestCell = function (cell) {
    return {
        capacity: cell.capacity,
        count: cell.count,
        owner: cell.owner
    };
};

const changedTestCell = function (cell, owner, count) {
    return {
        capacity: cell.capacity,
        count,
        owner
    };
};

const mergeOverrides = function (overrides, board) {
    return Object.assign({}, overrides, {
        board,
        size: board.length
    });
};

const withCell = function (board, row, column, owner, count) {
    return board.map(function (boardRow, rowIndex) {
        return boardRow.map(function (cell, columnIndex) {
            if (rowIndex !== row || columnIndex !== column) {
                return copyTestCell(cell);
            }

            return changedTestCell(cell, owner, count);
        });
    });
};

const stateWithBoard = function (board, overrides = {}) {
    return loadGame(emptyState(mergeOverrides(overrides, board)));
};

test("given a new easy game, when inspected, then it is an empty 6 by 6 board with Blue first", function () {
    const state = startNewGame({ difficulty: "easy" });
    const board = getPond(state);

    assert.equal(board.length, 6, "easy board should have six rows");
    assert.deepEqual(
        board.map(function (row) {
            return row.length;
        }),
        [6, 6, 6, 6, 6, 6],
        "easy board should have six tiles in every row"
    );
    assert.equal(getPlayerToMove(state), BLUE, "Blue should take the first turn");
    assert.equal(getGameStatus(state), "playing", "new game should start in playing state");
    assert.equal(getPondTile(state, 0, 0).capacity, 2, "corner capacity should be two");
    assert.equal(getPondTile(state, 0, 2).capacity, 3, "edge capacity should be three");
    assert.equal(getPondTile(state, 2, 2).capacity, 4, "centre capacity should be four");
});

test("given difficulty options, when games are created, then board sizes match the brief", function () {
    assert.equal(startNewGame({ difficulty: "easy" }).size, 6, "easy should be 6 by 6");
    assert.equal(startNewGame({ difficulty: "medium" }).size, 8, "medium should be 8 by 8");
    assert.equal(startNewGame({ difficulty: "hard" }).size, 10, "hard should be 10 by 10");
});

test("given invalid setup options, when a game is created, then a useful error is thrown", function () {
    assert.throws(
        function () {
            startNewGame({ difficulty: "expert" });
        },
        RangeError,
        "unknown difficulties should be rejected"
    );
    assert.throws(
        function () {
            startNewGame({ size: 2 });
        },
        RangeError,
        "too-small custom boards should be rejected"
    );
});

test("given legal targets, when inspected, then empty and own tiles are legal but opponent tiles are not", function () {
    const afterBlue = placeSlime(startNewGame({ size: 3 }), 0, 0);

    assert.equal(canPlaceSlime(afterBlue, 0, 1), true, "Red may place into an empty tile");
    assert.equal(canPlaceSlime(afterBlue, 0, 0), false, "Red may not place into Blue's tile");

    const afterRed = placeSlime(afterBlue, 0, 1);

    assert.equal(canPlaceSlime(afterRed, 0, 0), true, "Blue may place into Blue's own tile");
    assert.equal(
        getPlayableTiles(afterRed).some(function (move) {
            return move.row === 0 && move.column === 1;
        }),
        false,
        "Blue should not see Red's tile as a legal target"
    );
});

test("given an opponent tile, when a slime is placed there, then state and turn are unchanged", function () {
    const afterBlue = placeSlime(startNewGame({ size: 3 }), 0, 0);
    const afterIllegal = placeSlime(afterBlue, 0, 0);

    assert.equal(afterIllegal, afterBlue, "illegal placements should return the original state");
    assert.equal(getPlayerToMove(afterIllegal), RED, "turn should not advance after illegal placement");
    assert.equal(getPondTile(afterIllegal, 0, 0).owner, BLUE, "opponent tile should not change owner");
});

test("given invalid placements, when they are attempted, then state and turn are unchanged", function () {
    const before = startNewGame({ size: 3 });
    const afterBadRow = placeSlime(before, "top", 0);
    const afterBadColumn = placeSlime(before, 0, "left");
    const afterOutOfBounds = placeSlime(before, 4, 0);

    assert.equal(afterBadRow, before, "bad row values should return the original state");
    assert.equal(afterBadColumn, before, "bad column values should return the original state");
    assert.equal(afterOutOfBounds, before, "out-of-bounds placements should return the original state");
    assert.equal(getPlayerToMove(before), BLUE, "invalid placements should not advance the turn");
});

test("given a legal move, when applied, then the new state changes and the old state remains unchanged", function () {
    const before = startNewGame({ size: 3 });
    const after = placeSlime(before, 1, 1);

    assert.notEqual(after, before, "legal move should return a new state object");
    assert.equal(getPondTile(after, 1, 1).owner, BLUE, "new state should contain the placed slime");
    assert.equal(getPondTile(after, 1, 1).count, 1, "new state should increase slime count");
    assert.equal(getPondTile(before, 1, 1).owner, null, "previous state should remain empty");
});

test("given controlled tiles, when scores are requested, then tiles and slimes are counted", function () {
    const board = withCell(
        withCell(
            withCell(createEmptyPond(3), 0, 0, BLUE, 1),
            1,
            1,
            BLUE,
            2
        ),
        2,
        2,
        RED,
        3
    );
    const state = stateWithBoard(board);

    assert.deepEqual(getTerritoryScores(state), {
        blue: {
            slimes: 3,
            tiles: 2
        },
        red: {
            slimes: 3,
            tiles: 1
        }
    }, "scores should report controlled tiles and total slimes");
});

test("given a legal placement, when last placement is requested, then a public summary is returned", function () {
    const after = placeSlime(startNewGame({ size: 3 }), 1, 1);
    const last = getLastPlacement(after);

    assert.notEqual(last, null, "last placement should exist after a legal placement");
    assert.equal(last.player, BLUE, "last placement should record the player");
    assert.equal(last.row, 1, "last placement should record the row");
    assert.equal(last.column, 1, "last placement should record the column");
    assert.equal(last.explosions, 0, "quiet placements should record no explosions");
    assert.equal(last.tilesCaptured, 0, "quiet placements should record no captures");
    assert.equal(last.summary, "Blue charged B2.", "summary should describe the placement");
});

test("given a charged corner, when it reaches capacity, then it explodes to its two neighbours", function () {
    const board = withCell(createEmptyPond(3), 0, 0, BLUE, 1);
    const state = stateWithBoard(board, {
        currentPlayer: BLUE
    });
    const after = placeSlime(state, 0, 0);

    assert.equal(getPondTile(after, 0, 0).owner, null, "exploded corner should become empty");
    assert.equal(getPondTile(after, 0, 0).count, 0, "exploded corner should lose all energy");
    assert.equal(getPondTile(after, 0, 1).owner, BLUE, "right neighbour should receive Blue energy");
    assert.equal(getPondTile(after, 1, 0).owner, BLUE, "down neighbour should receive Blue energy");
    assert.equal(getGameStats(after).totalExplosions, 1, "one explosion should be recorded");
});

test("given an enemy beside an explosion, when energy enters it, then ownership converts", function () {
    const board = withCell(
        withCell(createEmptyPond(3), 0, 0, BLUE, 1),
        0,
        1,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            blue: 1,
            red: 1
        }
    });
    const after = placeSlime(state, 0, 0);

    assert.equal(getPondTile(after, 0, 1).owner, BLUE, "enemy tile should convert to Blue");
    assert.equal(getPondTile(after, 0, 1).count, 2, "converted tile should retain and add energy");
    assert.equal(getGameStats(after).tilesCaptured, 1, "conversion should be counted as a capture");
});

test("given an explosion creates another critical tile, when resolved, then the full chain completes", function () {
    const board = withCell(
        withCell(createEmptyPond(3), 0, 0, BLUE, 1),
        0,
        1,
        BLUE,
        2
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE
    });
    const after = placeSlime(state, 0, 0);

    assert.equal(getPondTile(after, 0, 1).owner, null, "second exploding tile should also empty");
    assert.equal(getPondTile(after, 0, 2).owner, BLUE, "chain should distribute to the far edge");
    assert.equal(getPondTile(after, 1, 1).owner, BLUE, "chain should distribute downwards");
    assert.equal(getGameStats(after).totalExplosions, 2, "two explosions should be recorded");
    assert.equal(getGameStats(after).largestChainReaction, 2, "largest chain should be two");
});

test("given Blue has moved first, when Red has zero tiles, then opening protection prevents victory", function () {
    const afterBlue = placeSlime(startNewGame({ size: 3 }), 0, 0);

    assert.equal(getGameStatus(afterBlue), "playing", "game should continue before Red has moved");
    assert.equal(getWinner(afterBlue), null, "no winner should be declared in the opening phase");
});

test("given both players have moved, when Red is eliminated, then Blue wins", function () {
    const board = withCell(
        withCell(createEmptyPond(3), 0, 0, BLUE, 1),
        0,
        1,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            blue: 1,
            red: 1
        }
    });
    const after = placeSlime(state, 0, 0);

    assert.equal(getGameStatus(after), "won", "game should enter won state");
    assert.equal(getWinner(after), BLUE, "Blue should win after Red has zero tiles");
});

test("given a won game, when another move is attempted, then the terminal state is preserved", function () {
    const board = withCell(
        withCell(createEmptyPond(3), 0, 0, BLUE, 1),
        0,
        1,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            blue: 1,
            red: 1
        }
    });
    const won = placeSlime(state, 0, 0);
    const afterTerminalMove = placeSlime(won, 1, 1);

    assert.equal(afterTerminalMove, won, "moves after a win should return the terminal state");
    assert.equal(getGameStatus(afterTerminalMove), "won", "game should remain won");
    assert.equal(getWinner(afterTerminalMove), BLUE, "winner should not change after the game ends");
});

test("given a move with explosions and captures, when complete, then statistics update", function () {
    const board = withCell(
        withCell(createEmptyPond(3), 0, 0, BLUE, 1),
        1,
        0,
        RED,
        1
    );
    const state = stateWithBoard(board, {
        currentPlayer: BLUE,
        turnsTaken: {
            blue: 1,
            red: 1
        }
    });
    const after = placeSlime(state, 0, 0);
    const stats = getGameStats(after);

    assert.equal(stats.totalTurns, 1, "one legal turn should be recorded from the fixture");
    assert.equal(stats.totalExplosions, 1, "one explosion should be counted");
    assert.equal(stats.largestChainReaction, 1, "largest chain should record the move chain length");
    assert.equal(stats.tilesCaptured, 1, "one captured tile should be counted");
});

test("given a previous state exists, when undoLastTurn is requested, then that state is restored", function () {
    const before = startNewGame({ size: 3 });
    const after = placeSlime(before, 2, 2);
    const restored = undoLastTurn(after);

    assert.deepEqual(getPond(restored), getPond(before), "undoLastTurn should restore the previous board");
    assert.equal(getPlayerToMove(restored), getPlayerToMove(before), "undoLastTurn should restore current player");
    assert.equal(restored.turn, before.turn, "undoLastTurn should restore turn number");
});

test(
    "given many turns, when history is inspected and undone, " +
    "then snapshots stay compact and support repeated undoLastTurn",
    function () {
    const played = Array.from({ length: 18 }).reduce(function (state) {
        const move = getPlayableTiles(state).find(function (candidate) {
            return getPondTile(state, candidate.row, candidate.column).owner === null;
        });

        return placeSlime(state, move.row, move.column);
    }, startNewGame({ difficulty: "easy" }));
    const firstUndo = undoLastTurn(played);
    const secondUndo = undoLastTurn(firstUndo);

    assert.equal(played.history.length, 18, "one compact snapshot should be stored per legal turn");
    assert.equal(
        played.history.every(function (snapshot) {
            return JSON.parse(snapshot).history === undefined;
        }),
        true,
        "history snapshots should not recursively contain prior history"
    );
    assert.equal(firstUndo.turn, played.turn - 1, "first undoLastTurn should restore the previous turn");
    assert.equal(secondUndo.turn, played.turn - 2, "second undoLastTurn should still be available");
    }
);

test("given a game state, when saved and loaded, then public state is preserved", function () {
    const played = placeSlime(placeSlime(startNewGame({ size: 3 }), 0, 0), 0, 1);
    const loaded = loadGame(saveGame(played));

    assert.deepEqual(getPond(loaded), getPond(played), "loaded board should match saved board");
    assert.equal(getPlayerToMove(loaded), getPlayerToMove(played), "loaded current player should match");
    assert.equal(getGameStatus(loaded), getGameStatus(played), "loaded status should match");
    assert.deepEqual(getTerritoryScores(loaded), getTerritoryScores(played), "loaded scores should match");
    assert.deepEqual(getGameStats(loaded), getGameStats(played), "loaded stats should match");
});
