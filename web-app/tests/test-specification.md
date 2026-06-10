# Unit Test Specification

These tests describe externally visible behaviour of `SlimeReaction.js`. They avoid
private implementation details so the game module can be refactored without
invalidating the specification.

## New Game

Given a new easy game, when the board is inspected, then it has 6 rows, each
row has 6 cells, Blue moves first, and all cells are empty with correct
capacities.

## Difficulty Layouts

Given the three difficulty options, when games are created, then their board
sizes are 6 by 6, 8 by 8, and 10 by 10.

## Legal Moves

Given a playing game, when the current player targets an empty cell or one of
their own cells, then the move is legal.

Given a cell owned by the opponent, when the current player targets that cell,
then the state is returned unchanged and the turn does not advance.

## Immutable State

Given a legal move, when it is applied, then a new state is returned and the
previous state still contains the old board data.

## Explosion Resolution

Given a corner cell one orb away from capacity, when its owner places another
orb there, then it explodes, becomes empty, and gives one orb to each
orthogonal neighbour.

## Ownership Conversion

Given an opponent cell next to an exploding cell, when the explosion sends an
orb into it, then the opponent cell immediately changes owner.

## Chain Reactions

Given an explosion that makes a neighbouring cell reach critical mass, when
the move resolves, then all resulting explosions are completed before the turn
passes.

## Opening Elimination Rule

Given Blue's first move, when Red has not yet completed a turn, then Red is
not eliminated even though Red controls zero cells.

## Victory

Given both players have completed at least one turn, when a chain reaction
leaves one player with zero controlled cells, then the other player wins.

## Statistics

Given a move with explosions and conversions, when the move completes, then
total turns, total explosions, largest chain reaction, and captured cells are
updated.

## Undo

Given at least one legal turn has been made, when undo is requested, then the
previous state is restored.

## Save And Load

Given a game state, when it is serialized and deserialized, then board state,
turn, current player, status, and statistics are preserved.
