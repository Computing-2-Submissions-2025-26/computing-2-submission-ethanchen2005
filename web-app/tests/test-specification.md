# Unit Test Specification

These tests describe externally visible behaviour of `SlimeReaction.js`. They avoid
private implementation details so the game module can be refactored without
invalidating the specification.

## New Game

Given a new easy game, when the pond is inspected, then it has 6 rows, each
row has 6 tiles, Blue moves first, and all tiles are empty with correct
capacities.

## Difficulty Layouts

Given the three difficulty options, when games are created, then their board
sizes are 6 by 6, 8 by 8, and 10 by 10.

Given invalid setup options, when a game is created, then a useful error is
thrown instead of silently creating an invalid board.

## Playable Tiles

Given a playing game, when the current player targets an empty tile or one of
their own tiles, then the slime placement is legal.

Given a tile owned by the opponent, when the current player targets that tile,
then the state is returned unchanged and the turn does not advance.

Given an invalid row, invalid column, or out-of-bounds target, when a slime is
placed, then the state is returned unchanged and the turn does not advance.

## Immutable State

Given a legal slime placement, when it is applied, then a new state is returned and the
previous state still contains the old board data.

## Explosion Resolution

Given a corner tile one slime away from capacity, when its owner places another
slime there, then it explodes, becomes empty, and gives one slime to each
orthogonal neighbour.

## Ownership Conversion

Given an opponent tile next to an exploding tile, when the explosion sends a
slime into it, then the opponent tile immediately changes owner.

## Chain Reactions

Given an explosion that makes a neighbouring tile reach critical mass, when
the placement resolves, then all resulting explosions are completed before the turn
passes.

## Opening Elimination Rule

Given Blue's first move, when Red has not yet completed a turn, then Red is
not eliminated even though Red controls zero tiles.

## Victory

Given both players have completed at least one turn, when a chain reaction
leaves one player with zero controlled tiles, then the other player wins.

Given a game has already been won, when another placement is attempted, then the
terminal state and winner are preserved.

## Statistics

Given a placement with explosions and conversions, when the placement completes, then
total turns, total explosions, largest chain reaction, and captured tiles are
updated.

## Undo

Given at least one legal turn has been made, when undoLastTurn is requested, then the
previous state is restored.

## Save And Load

Given a game state, when it is saved and loaded, then board state,
turn, current player, status, and statistics are preserved.
