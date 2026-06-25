# Slime Reaction

**CID**: 02603570

Slime Reaction is my turn-based board game for the Computing 2 Applications
coursework. Players add slimes to tiles, build them up until they split,
and try to take over the other player's side through chain reactions.

The game logic is separate from the browser code. `SlimeReaction.js` holds the
rules and public API, while `main.js` only uses that API to render the board,
handle input, play sounds, and run the simple AI.

## How to play

Blue always moves first. On a turn, a player can place a slime on an empty pond
tile or on one of their own tiles.

Each tile has a capacity:

- Corner tiles split at 2 slimes.
- Edge tiles split at 3 slimes.
- Centre tiles split at 4 slimes.

When a tile reaches its capacity, it splits. The slime moves into neighbouring
tiles, which can capture enemy tiles and trigger more splits. A player wins
when the other player has no tiles left after both players have taken at least
one turn.

## Game modes

- `VS AI`: the user plays as Blue and the Pink Slime AI replies after each move.
- `VS Player`: two players share the same screen and take turns manually.

The home screen also has Easy, Medium, and Hard board sizes.

## Controls

- `Play`: start a new match.
- `How To Play`: open the visual rule guide.
- `Hint`: highlight a useful legal move.
- `Undo`: go back one move. In `VS AI` mode, this rewinds the player move and
  the AI reply together.
- `Restart`: start the current match again.
- `Home`: return to the title screen.
- `Sound`: toggle interface, move, split, invalid move, and victory sounds.

The board also works with the keyboard. Move focus with the arrow keys and press
`Enter` or `Space` to place a slime.

## Coursework checklist

### Install dependencies locally

- [x] Dependencies are listed in `package.json`.
- [x] Dependencies install with `npm install`.

### Game module API

- [x] A documented JavaScript module is included in `web-app/SlimeReaction.js`.
- [x] `jsdoc.json` points to the game module.
- [x] JSDoc has been generated into `docs/`.
- [x] Generated API documentation has been checked.

### Game module implementation

- [x] The game module API is implemented.
- [x] Game rules can be simulated independently from the browser UI.

### Unit test specification

- [x] Behavioural test descriptions are included in `web-app/tests`.
- [x] The tests describe externally visible game behaviour.

### Unit test implementation

- [x] Automated tests are implemented.
- [x] Tests run with `npm test`.

### Web application

- [x] `web-app/index.html` is implemented.
- [x] `web-app/default.css` is implemented.
- [x] `web-app/main.js` is implemented.
- [x] Required assets and supporting files are included.

### Final submission

- [x] Push to GitHub.
- [x] Sync the changes.
- [x] Check the submission on GitHub.

## Project structure

- `web-app/SlimeReaction.js`: pure game module and public game API.
- `web-app/main.js`: browser UI, rendering, input handling, sound, and AI.
- `web-app/default.css`: visual styling and responsive layout.
- `web-app/index.html`: page structure for the home screen, board, panels, and dialogs.
- `web-app/assets/`: images, interface icons, and sound effects.
- `web-app/tests/test-specification.md`: behavioural test plan.
- `web-app/tests/SlimeReaction.test.js`: automated tests for the game module.
- `docs/`: generated API documentation linked from the web app.

## Run the game

Install dependencies:

```sh
npm install
```

Start the local web server:

```sh
npm start
```

Open:

```text
http://localhost:5173
```

## Test and check

Run the unit tests:

```sh
npm test
```

Run syntax checks:

```sh
npm run check
```

The API documentation has already been generated into `docs/` and is linked
from the web app landing screen.

## Public API

The browser imports `SlimeReaction.js` and uses its public functions rather than
copying the game rules in `main.js`.

- Starting and playing: `startNewGame`, `restartGame`, `placeSlime`,
  `canPlaceSlime`, and `getPlayableTiles`.
- Reading the game state: `getPond`, `getPondTile`, `getPlayerToMove`,
  `getGameStatus`, `getWinner`, `getTerritoryScores`, `getGameStats`, and
  `getLastPlacement`.
- Continuing a game: `undoLastTurn`, `saveGame`, and `loadGame`.

The game module returns new game states or copies of state data, so old turns
are not changed by the interface.

## Accessibility

The interface uses real buttons, modal dialogs, ARIA live messages, a labelled
board grid, per-tile labels, and visible focus states. Scores and tile ownership
are shown with text and numbers as well as colour, so the rules do not depend
only on slime colour.
