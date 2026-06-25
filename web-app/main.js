/*jslint browser, long, white */
import SlimeReaction from "./SlimeReaction.js";

const {
    BLUE,
    RED,
    canPlaceSlime,
    formatCoordinate,
    getGameStats,
    getGameStatus,
    getLastPlacement,
    getPlayableTiles,
    getPlayerToMove,
    getPond,
    getPondTile,
    getTerritoryScores,
    getWinner,
    placeSlime,
    restartGame,
    startNewGame,
    undoLastTurn
} = SlimeReaction;

// String literals and image sources.
const player_names = {
    blue: "Blue Slime",
    red: "Pink Slime"
};

const player_images = {
    player: {
        blue: "./assets/player/blue-player.png",
        red: "./assets/player/red-player.png"
    },
    tile: {
        blue: "./assets/tiles/blue-slime-on-tile.png",
        red: "./assets/tiles/red-slime-on-tile.png"
    },
    winner: {
        blue: "./assets/player/blue-winner.png",
        red: "./assets/player/red-winner.png"
    }
};

const sound_sources = {
    invalid: ["./assets/music/Invalid movement.mp3", 0.55],
    place: ["./assets/music/Place.mp3", 0.5],
    split: ["./assets/music/Split.mp3", 0.6],
    ui: ["./assets/music/UI click.mp3", 0.35],
    win: ["./assets/music/Win.mp3", 0.65]
};

const ai_player = RED;
const ai_delay = 550;
const el = function (id) {
    return document.getElementById(id);
};

const dom_ids = [
    "landing_screen", "game_screen", "game_board", "rules_dialog",
    "game_over_dialog", "play_button", "how_to_play_button", "music_button",
    "help_tool_button", "home_tool_button", "hint_button", "undo_button",
    "restart_button", "play_again_button", "home_after_game_button",
    "turn_banner", "turn_image", "turn_title", "turn_copy", "turn_value",
    "blue_tiles", "red_tiles", "status_output", "combo_pop", "selected_cell",
    "largest_chain", "tiles_captured", "assistant_tip", "winner_image",
    "game_over_title", "final_score", "final_turns", "final_chain",
    "final_captures"
];
const dom = Object.fromEntries(dom_ids.map(function (id) {
    return [id, el(id)];
}));
const {
    landing_screen, game_screen, game_board, rules_dialog, game_over_dialog,
    play_button, how_to_play_button, music_button, help_tool_button,
    home_tool_button, hint_button, undo_button, restart_button,
    play_again_button, home_after_game_button, turn_banner, turn_image,
    turn_title, turn_copy, turn_value, blue_tiles, red_tiles, status_output,
    combo_pop, largest_chain, tiles_captured, assistant_tip, winner_image,
    game_over_title, final_score, final_turns, final_chain, final_captures
} = dom;
const selected_cell_box = dom.selected_cell;
const mode_buttons = Array.from(document.querySelectorAll(".mode_option"));
const difficulty_buttons = Array.from(document.querySelectorAll(".difficulty_option"));

let mode = "ai";
let difficulty = "medium";
let game = startNewGame({ difficulty });
let selected_tile = null;
let changed_tile = null;
let board_message = "Choose a pond tile.";
let sound_on = true;
let ai_thinking = false;
let ai_timer = null;
let play_cell;

const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
const audio_context = (
    AudioContextConstructor === undefined
    ? null
    : new AudioContextConstructor()
);
const sound_buffers = {};
const sound_players = {};

const make = function (tag, class_name, text) {
    const element = document.createElement(tag);

    if (class_name !== "") {
        element.className = class_name;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
};

const ignore_audio_error = function () {
    return undefined;
};

const load_sound = function (name) {
    const audio = document.createElement("audio");
    const source = sound_sources[name][0];

    audio.src = source;
    audio.preload = "auto";
    audio.volume = sound_sources[name][1];
    audio.load();
    sound_players[name] = audio;

    if (audio_context !== null) {
        window.fetch(source).then(function (response) {
            if (!response.ok) {
                throw new Error("Could not load sound.");
            }
            return response.arrayBuffer();
        }).then(function (data) {
            return audio_context.decodeAudioData(data);
        }).then(function (buffer) {
            sound_buffers[name] = buffer;
        }).catch(ignore_audio_error);
    }
};

const wake_audio = function () {
    if (audio_context !== null && audio_context.state === "suspended") {
        audio_context.resume().catch(ignore_audio_error);
    }
};

const play_buffer = function (name) {
    const gain = audio_context.createGain();
    const player = audio_context.createBufferSource();

    player.buffer = sound_buffers[name];
    gain.gain.value = sound_sources[name][1];
    player.connect(gain);
    gain.connect(audio_context.destination);
    player.start(0);
};

const play_sound = function (name) {
    const audio = sound_players[name];
    let request;

    if (!sound_on || sound_sources[name] === undefined) {
        return;
    }
    wake_audio();
    if (audio_context !== null && sound_buffers[name] !== undefined) {
        play_buffer(name);
        return;
    }
    audio.currentTime = 0;
    request = audio.play();
    if (request !== undefined) {
        request.catch(ignore_audio_error);
    }
};

Object.keys(sound_sources).forEach(load_sound);
["keydown", "pointerdown"].forEach(function (event_name) {
    document.addEventListener(event_name, wake_audio, {
        capture: true,
        once: true
    });
});

const player_name = function (player) {
    return player_names[player];
};

const owner_name = function (owner) {
    if (owner === null) {
        return "Empty";
    }
    return (
        owner === BLUE
        ? "Blue"
        : "Pink"
    );
};

const is_ai_mode = function () {
    return mode === "ai";
};

const is_ai_turn = function () {
    return (
        is_ai_mode()
        && getGameStatus(game) === "playing"
        && getPlayerToMove(game) === ai_player
    );
};

const show_screen = function (screen) {
    landing_screen.classList.toggle("hidden", screen !== landing_screen);
    game_screen.classList.toggle("hidden", screen !== game_screen);
};

const clear_ai_timer = function () {
    if (ai_timer !== null) {
        window.clearTimeout(ai_timer);
        ai_timer = null;
    }
    ai_thinking = false;
    document.body.classList.remove("ai_thinking");
};

const mark_choice = function (buttons, key, active_class, value) {
    buttons.forEach(function (button) {
        const chosen = button.dataset[key] === value;

        button.classList.toggle(active_class, chosen);
        button.setAttribute("aria-pressed", String(chosen));
    });
};

const set_mode = function (new_mode) {
    mode = new_mode;
    document.body.dataset.mode = mode;
    if (!is_ai_mode()) {
        clear_ai_timer();
    }
    mark_choice(mode_buttons, "mode", "active_mode", mode);
};

const set_difficulty = function (new_difficulty) {
    difficulty = new_difficulty;
    mark_choice(difficulty_buttons, "difficulty", "active_difficulty", difficulty);
};

const same_tile = function (tile, row, column) {
    return (
        tile !== null
        && tile.row === row
        && tile.column === column
    );
};

const clear_selection = function () {
    selected_tile = null;
    changed_tile = null;
};

const focus_cell = function (row, column) {
    const r = Math.max(0, Math.min(game.size - 1, row));
    const c = Math.max(0, Math.min(game.size - 1, column));
    const button = game_board.querySelector(`[data-row="${r}"][data-column="${c}"]`);

    if (button !== null) {
        button.focus();
    }
};

const is_ready_to_split = function (cell) {
    return cell.owner !== null && cell.count === cell.capacity - 1;
};

const other_player = function (player) {
    if (player === BLUE) {
        return RED;
    }
    return BLUE;
};

const score_position = function (state, player) {
    const opponent = other_player(player);
    const scores = getTerritoryScores(state);

    return (
        (scores[player].tiles - scores[opponent].tiles) * 10
        + scores[player].slimes
        - scores[opponent].slimes
    );
};

const score_move_now = function (state, move) {
    const player = getPlayerToMove(state);
    const cell = getPondTile(state, move.row, move.column);
    const after = placeSlime(state, move.row, move.column);
    const last = getLastPlacement(after);
    let score = score_position(after, player);

    if (getWinner(after) === player) {
        score += 1000;
    }
    if (cell.owner === null) {
        score += 4;
    }
    if (cell.owner === player) {
        score += 2;
    }
    if (cell.owner === player && is_ready_to_split(cell)) {
        score += 35;
    }
    if (last !== null) {
        score += last.explosions * 8;
        score += last.tilesCaptured * 18;
    }
    return score;
};

const reply_danger = function (state) {
    const player = getPlayerToMove(state);

    return getPlayableTiles(state).reduce(function (danger, move) {
        const cell = getPondTile(state, move.row, move.column);

        if (cell.owner !== player || !is_ready_to_split(cell)) {
            return danger;
        }
        return Math.max(danger, score_move_now(state, move));
    }, 0);
};

const score_ai_move = function (state, move) {
    const player = getPlayerToMove(state);
    const after = placeSlime(state, move.row, move.column);
    let score = score_move_now(state, move);

    if (getWinner(after) === player) {
        return score + 1000;
    }
    if (getGameStatus(after) === "playing") {
        score -= Math.floor(reply_danger(after) / 2);
    }
    return score;
};

const choose_ai_move = function () {
    const moves = getPlayableTiles(game);
    const best = moves.reduce(function (choice, move) {
        const score = score_ai_move(game, move);

        if (choice === null || score > choice.score) {
            return {
                move,
                score
            };
        }
        return choice;
    }, null);

    if (best === null) {
        return null;
    }
    return best.move;
};

const make_markers = function (total, filled, class_name) {
    const markers = make("span", class_name);
    let index = 0;

    while (index < total) {
        const dot = make("span", "");
        dot.className = (
            index < filled
            ? "filled"
            : ""
        );
        markers.append(dot);
        index += 1;
    }
    return markers;
};

const make_slime_art = function (cell, variant) {
    const wrap = make("span", `slime_art ${cell.owner} ${variant}_art`);
    const image = make("img", "");
    const count = make("span", "slime_count", String(cell.count));

    wrap.setAttribute("aria-hidden", "true");
    image.src = player_images.tile[cell.owner];
    image.alt = "";
    wrap.replaceChildren(image, count);
    return wrap;
};

const describe_cell = function (cell, row, column) {
    const action = (
        canPlaceSlime(game, row, column)
        ? "legal move"
        : "view only"
    );

    return (
        `${formatCoordinate(row, column)}, ${owner_name(cell.owner)}, ` +
        `${cell.count} of ${cell.capacity}, ${action}`
    );
};

const play_move = function (move) {
    game = placeSlime(game, move.row, move.column);
    changed_tile = {
        column: move.column,
        row: move.row
    };
};

const last_explosions = function () {
    const last = getLastPlacement(game);
    return (
        last === null
        ? 0
        : last.explosions
    );
};

const play_move_sound = function () {
    const sound = (
        last_explosions() > 0
        ? "split"
        : "place"
    );
    play_sound(sound);
};

const show_combo = function (explosions) {
    let text = "";

    if (explosions >= 6) {
        text = `MEGA CHAIN x${explosions}`;
    } else if (explosions >= 3) {
        text = `SLIME COMBO x${explosions}`;
    } else if (explosions > 0) {
        text = "SLIME SPLIT";
    }
    combo_pop.textContent = text;
    combo_pop.classList.toggle("show_combo", text !== "");
    if (text !== "") {
        window.setTimeout(function () {
            combo_pop.classList.remove("show_combo");
        }, 900);
    }
};

const handle_cell_key = function (event, row, column) {
    const moves = {
        ArrowDown: [row + 1, column],
        ArrowLeft: [row, column - 1],
        ArrowRight: [row, column + 1],
        ArrowUp: [row - 1, column]
    };

    if (event.key === "Enter" || event.key === " " || event.key === "Space") {
        event.preventDefault();
        play_cell(row, column);
    } else if (moves[event.key] !== undefined) {
        event.preventDefault();
        focus_cell(moves[event.key][0], moves[event.key][1]);
    }
};

const make_cell_button = function (cell, row, column) {
    const button = make("button", "pond_cell");
    const coordinate = make("span", "coordinate", formatCoordinate(row, column));
    const content = make("span", "cell_content");
    const pips = make_markers(cell.capacity, cell.count, "pips");
    const classes = [
        (
            cell.owner === null
            ? "empty"
            : cell.owner
        )
    ];
    const selected = same_tile(selected_tile, row, column);

    if (canPlaceSlime(game, row, column)) {
        classes.push("legal_cell");
    }
    if (selected) {
        classes.push("selected_cell_button");
    }
    if (is_ready_to_split(cell)) {
        classes.push("ready_cell");
    }
    if (same_tile(changed_tile, row, column)) {
        classes.push("changed_cell");
    }
    if (cell.owner !== null) {
        content.append(make_slime_art(cell, "tile"));
    }

    button.type = "button";
    button.className = `pond_cell ${classes.join(" ")}`;
    button.dataset.row = String(row);
    button.dataset.column = String(column);
    button.disabled = ai_thinking || is_ai_turn();
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", describe_cell(cell, row, column));
    button.setAttribute("aria-selected", String(selected));
    pips.setAttribute("aria-hidden", "true");
    button.onclick = function () {
        play_cell(row, column);
    };
    button.onkeydown = function (event) {
        handle_cell_key(event, row, column);
    };
    button.replaceChildren(coordinate, content, pips);
    return button;
};

const redraw_board = function () {
    const board = getPond(game);

    game_board.style.setProperty("--board-size", String(game.size));
    game_board.replaceChildren(...board.flatMap(function (row, row_index) {
        return row.map(function (cell, column_index) {
            return make_cell_button(cell, row_index, column_index);
        });
    }));
};

const detail_row = function (label, dots) {
    const row = make("div", "visual_row");
    row.replaceChildren(make("span", "", label), dots);
    return row;
};

const redraw_selected_cell = function () {
    if (selected_tile === null) {
        selected_cell_box.replaceChildren(make("span", "empty_state", "Select a pond tile."));
        return;
    }

    const cell = getPondTile(game, selected_tile.row, selected_tile.column);
    const title = make("strong", "", formatCoordinate(selected_tile.row, selected_tile.column));
    const owner_class = (
        cell.owner === null
        ? "neutral"
        : cell.owner
    );
    const owner = make("span", `owner_pill ${owner_class}`, owner_name(cell.owner));
    const preview = make("span", "selected_preview");
    const details = make("div", "selected_details");
    const action = make("span", "");

    if (cell.owner !== null) {
        preview.append(make_slime_art(cell, "preview"));
    }
    details.replaceChildren(
        detail_row("Capacity", make_markers(cell.capacity, cell.capacity, "visual_dots capacity_dots")),
        detail_row("Slimes", make_markers(cell.capacity, cell.count, "visual_dots slime_dots"))
    );
    if (canPlaceSlime(game, selected_tile.row, selected_tile.column)) {
        action.className = "next_action legal_action";
        action.textContent = (
            cell.count === cell.capacity - 1
            ? "+1 -> Split"
            : "+1"
        );
    } else {
        action.className = "next_action view_action";
        action.textContent = "View only";
    }
    selected_cell_box.replaceChildren(title, owner, preview, details, action);
};

const redraw_status = function () {
    const scores = getTerritoryScores(game);
    const stats = getGameStats(game);
    const player = getPlayerToMove(game);
    const winner = getWinner(game);
    const playing = getGameStatus(game) === "playing";
    const ai_active = playing && is_ai_turn();

    document.body.classList.toggle("ai_thinking", ai_thinking);
    turn_value.textContent = String(game.turn);
    blue_tiles.textContent = String(scores[BLUE].tiles);
    red_tiles.textContent = String(scores[RED].tiles);
    largest_chain.textContent = String(stats.largestChainReaction);
    tiles_captured.textContent = String(stats.tilesCaptured);
    turn_banner.className = (
        player === BLUE
        ? "turn_banner blue_turn"
        : "turn_banner pink_turn"
    );
    turn_image.src = player_images.player[player];
    status_output.value = board_message;
    hint_button.disabled = ai_active || ai_thinking;
    undo_button.disabled = game.history.length === 0 || ai_thinking;

    if (!playing) {
        turn_title.textContent = `${player_name(winner)} Wins`;
        turn_copy.textContent = "The match is over. Play again, undo, or restart.";
        assistant_tip.textContent = `${player_name(winner)} wins!`;
    } else if (ai_active) {
        turn_title.textContent = "Pink AI's Turn";
        turn_copy.textContent = "Slime Master is choosing a move.";
        assistant_tip.textContent = "AI is thinking...";
    } else {
        turn_title.textContent = (
            player === BLUE
            ? "Blue's Turn"
            : "Pink's Turn"
        );
        turn_copy.textContent = "Choose an empty pond or one of your own slimes.";
        assistant_tip.textContent = "Pick a glowing tile.";
        if (selected_tile !== null) {
            assistant_tip.textContent = (
                canPlaceSlime(game, selected_tile.row, selected_tile.column)
                ? "One more slime!"
                : "Choose your own slime."
            );
        }
    }
};

const show_result_dialog = function () {
    const winner = getWinner(game);
    const stats = getGameStats(game);
    const scores = getTerritoryScores(game);

    if (getGameStatus(game) !== "won" || winner === null || game_over_dialog.open) {
        return;
    }
    winner_image.src = player_images.winner[winner];
    game_over_title.textContent = (
        winner === BLUE
        ? "Blue Slimes Win"
        : "Pink Slimes Win"
    );
    final_score.textContent = String(scores[winner].tiles);
    final_turns.textContent = String(stats.totalTurns);
    final_chain.textContent = String(stats.largestChainReaction);
    final_captures.textContent = String(stats.tilesCaptured);
    play_sound("win");
    game_over_dialog.showModal();
};

const redraw = function () {
    redraw_board();
    redraw_selected_cell();
    redraw_status();
    show_result_dialog();
};

const finish_move_message = function () {
    const winner = getWinner(game);

    board_message = (
        getGameStatus(game) === "won"
        ? `${player_name(winner)} wins!`
        : `${player_name(getPlayerToMove(game))}'s turn.`
    );
};

const take_ai_turn = function () {
    const move = choose_ai_move();

    ai_timer = null;
    if (!is_ai_turn()) {
        ai_thinking = false;
        redraw();
        return;
    }
    if (move === null) {
        ai_thinking = false;
        board_message = "Slime Master has no legal move.";
        redraw();
        return;
    }
    selected_tile = move;
    play_move(move);
    play_move_sound();
    ai_thinking = false;
    finish_move_message();
    redraw();
    show_combo(last_explosions());
    focus_cell(move.row, move.column);
};

const schedule_ai_turn = function () {
    if (!is_ai_turn() || ai_thinking) {
        return;
    }
    ai_thinking = true;
    board_message = "Slime Master is choosing a move.";
    redraw();
    ai_timer = window.setTimeout(take_ai_turn, ai_delay);
};

const start_game = function () {
    clear_ai_timer();
    if (game_over_dialog.open) {
        game_over_dialog.close();
    }
    game = startNewGame({ difficulty });
    clear_selection();
    board_message = (
        is_ai_mode()
        ? "Blue starts a Slime Master challenge."
        : "Blue starts a friendly pond battle."
    );
    show_screen(game_screen);
    redraw();
    focus_cell(0, 0);
};

play_cell = function (row, column) {
    if (ai_thinking || is_ai_turn()) {
        board_message = "Slime Master is choosing a move.";
        schedule_ai_turn();
        redraw();
        return;
    }
    selected_tile = {
        column,
        row
    };
    if (getGameStatus(game) !== "playing") {
        show_result_dialog();
        return;
    }
    if (!canPlaceSlime(game, row, column)) {
        changed_tile = null;
        board_message = "Rival pond selected. Pick an empty or friendly pond.";
        play_sound("invalid");
        redraw();
        focus_cell(row, column);
        return;
    }
    play_move({ column, row });
    play_move_sound();
    finish_move_message();
    redraw();
    show_combo(last_explosions());
    if (is_ai_turn()) {
        schedule_ai_turn();
    } else {
        focus_cell(row, column);
    }
};

play_button.onclick = function () {
    play_sound("ui");
    start_game();
};

how_to_play_button.onclick = function () {
    play_sound("ui");
    rules_dialog.showModal();
};

help_tool_button.onclick = how_to_play_button.onclick;

home_tool_button.onclick = function () {
    play_sound("ui");
    clear_ai_timer();
    show_screen(landing_screen);
};

music_button.onclick = function () {
    sound_on = !sound_on;
    music_button.classList.toggle("muted", !sound_on);
    if (sound_on) {
        play_sound("ui");
    }
};

mode_buttons.forEach(function (button) {
    button.onclick = function () {
        play_sound("ui");
        set_mode(button.dataset.mode);
    };
});

difficulty_buttons.forEach(function (button) {
    button.onclick = function () {
        play_sound("ui");
        set_difficulty(button.dataset.difficulty);
    };
});

hint_button.onclick = function () {
    const move = choose_ai_move();

    if (ai_thinking || is_ai_turn() || move === null) {
        return;
    }
    selected_tile = move;
    board_message = `Try ${formatCoordinate(move.row, move.column)}.`;
    play_sound("ui");
    redraw();
    focus_cell(move.row, move.column);
};

undo_button.onclick = function () {
    let previous = undoLastTurn(game);

    play_sound("ui");
    clear_ai_timer();
    if (is_ai_mode() && getPlayerToMove(previous) === ai_player && previous.history.length > 0) {
        previous = undoLastTurn(previous);
    }
    game = previous;
    clear_selection();
    board_message = "Move undone.";
    redraw();
    focus_cell(0, 0);
};

restart_button.onclick = function () {
    play_sound("ui");
    clear_ai_timer();
    game = restartGame(game);
    clear_selection();
    board_message = "Game restarted.";
    redraw();
    focus_cell(0, 0);
};

play_again_button.onclick = function () {
    play_sound("ui");
    start_game();
};

home_after_game_button.onclick = function () {
    play_sound("ui");
    clear_ai_timer();
    game_over_dialog.close();
    show_screen(landing_screen);
};

set_mode("ai");
set_difficulty("medium");
redraw();
