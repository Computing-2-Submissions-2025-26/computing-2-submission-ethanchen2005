# Slime Reaction

Slime Reaction is a bright browser strategy game based on Chain Reaction. Two
slime kingdoms compete for control of a magical pond by placing slimes, causing
splits, and capturing rival tiles.

This project was built for the Imperial College Computing 2 Applications
coursework. The game logic is kept separate from the browser interface so that
the rules can be tested independently.

## How to Play

Your goal is to take over the pond. Blue always moves first. On your turn, click
one empty pond tile or one tile that already belongs to you.

Each tile has a capacity:

- Corner tiles split at 2 slimes.
- Edge tiles split at 3 slimes.
- Centre tiles split at 4 slimes.

When a tile reaches its capacity, it splits. The slime on that tile moves into
its neighbouring tiles, which can capture enemy tiles and trigger more splits.
This can create large chain reactions.

A player wins when the other player has no tiles left after both players have
taken at least one turn.

## Game Modes

- `VS AI`: You play as Blue. The Pink Slime AI automatically chooses its move
  after your turn.
- `VS Player`: Two players share the same screen and take turns manually.

Use the game mode switch on the home screen before pressing `Play`.

## Controls

- `Play`: Start a new match.
- `How To Play`: Open the visual rule guide.
- `Hint`: Highlight a useful legal move.
- `Undo`: Go back one move. In `VS AI` mode, this rewinds the player's move and
  the AI response together.
- `Restart`: Start the current match again.
- `Home`: Return to the title screen.
- `Settings`: Change accessibility options such as reduced motion or contrast.

The board can also be used with the keyboard. Move focus with the arrow keys and
press `Enter` or `Space` to place a slime.

## Run the Game

Install Node.js, then run:

```sh
npm start
```

Open this address in a browser:

```text
http://localhost:5173
```

## Test the Project

Run the automated unit tests:

```sh
npm test
```

Run the syntax checks:

```sh
npm run check
```

## Project Structure

- `web-app/SlimeReaction.js`: pure game module and public game API.
- `web-app/main.js`: browser UI, rendering, input handling, and AI controller.
- `web-app/default.css`: visual styling and responsive layout.
- `web-app/assets/`: game images and interface icons.
- `web-app/tests/SlimeReaction.test.js`: automated tests for the game module.
- `web-app/tests/test-specification.md`: test plan and expected behaviour.

The browser code calls exported functions from `SlimeReaction.js` instead of
duplicating rules in the UI. This keeps the gameplay predictable, testable, and
easier to explain in the coursework submission.
