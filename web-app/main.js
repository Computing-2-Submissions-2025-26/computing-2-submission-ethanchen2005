/*jslint browser */
import SlimeReaction from "./SlimeReaction.js";

const {
    BLUE,
    RED,
    applyAction,
    calculateScores,
    createGame,
    formatCoordinate,
    getBoard,
    getCell,
    getCurrentPlayer,
    getLegalMoves,
    getStats,
    getStatus,
    getWinner,
    isMoveLegal,
    restart,
    undo
} = SlimeReaction;

const PLAYER_NAMES = Object.freeze({
    [BLUE]: "Blue Slime",
    [RED]: "Pink Slime"
});

const PLAYER_IMAGES = Object.freeze({
    leader: Object.freeze({
        [BLUE]: "./assets/player/blue-winner.png",
        [RED]: "./assets/player/red-winner.png"
    }),
    tile: Object.freeze({
        [BLUE]: "./assets/tiles/blue-slime-on-tile.png",
        [RED]: "./assets/tiles/red-slime-on-tile.png"
    })
});

const AI_PLAYER = RED;
const AI_DELAY_MS = 550;

const el = (id) => document.getElementById(id);

const landing_screen = el("landing_screen");
const game_screen = el("game_screen");
const play_button = el("play_button");
const how_to_play_button = el("how_to_play_button");
const music_button = el("music_button");
const settings_button = el("settings_button");
const mode_buttons = Array.from(document.querySelectorAll(".mode_option"));
const rules_dialog = el("rules_dialog");
const settings_dialog = el("settings_dialog");
const game_over_dialog = el("game_over_dialog");
const high_contrast_toggle = el("high_contrast_toggle");
const colour_blind_toggle = el("colour_blind_toggle");
const reduced_motion_toggle = el("reduced_motion_toggle");
const help_tool_button = el("help_tool_button");
const settings_tool_button = el("settings_tool_button");
const home_tool_button = el("home_tool_button");
const game_board = el("game_board");
const turn_banner = el("turn_banner");
const turn_image = el("turn_image");
const turn_title = el("turn_title");
const turn_copy = el("turn_copy");
const turn_value = el("turn_value");
const blue_tiles = el("blue_tiles");
const red_tiles = el("red_tiles");
const status_output = el("status_output");
const combo_pop = el("combo_pop");
const selected_cell = el("selected_cell");
const largest_chain = el("largest_chain");
const cells_captured = el("cells_captured");
const assistant_tip = el("assistant_tip");
const hint_button = el("hint_button");
const undo_button = el("undo_button");
const restart_button = el("restart_button");
const winner_image = el("winner_image");
const game_over_title = el("game_over_title");
const game_over_copy = el("game_over_copy");
const final_score = el("final_score");
const final_turns = el("final_turns");
const final_chain = el("final_chain");
const final_captures = el("final_captures");
const play_again_button = el("play_again_button");
const home_after_game_button = el("home_after_game_button");

let game = createGame({ difficulty: "medium" });
let selected_mode = "ai";
let selected_coordinate = null;
let focused_coordinate = { row: 0, column: 0 };
let last_changed_coordinate = null;
let board_message = "Choose a pond tile.";
let sound_on = true;
let ai_thinking = false;
let ai_timer = null;

const show_screen = function (screen) {
    [landing_screen, game_screen].forEach(function (element) {
        element.classList.toggle("hidden", element !== screen);
    });
};

const player_name = (player) => PLAYER_NAMES[player];

const opponent_of = function (player) {
    return player === BLUE ? RED : BLUE;
};

const clear_ai_timer = function () {
    if (ai_timer !== null) {
        window.clearTimeout(ai_timer);
        ai_timer = null;
    }

    ai_thinking = false;
    document.body.classList.remove("ai_thinking");
};

const is_ai_mode = function () {
    return selected_mode === "ai";
};

const is_ai_turn = function () {
    return (
        is_ai_mode()
        && getStatus(game) === "playing"
        && getCurrentPlayer(game) === AI_PLAYER
    );
};

const set_mode = function (mode) {
    selected_mode = mode;
    document.body.dataset.mode = mode;

    if (mode !== "ai") {
        clear_ai_timer();
    }

    mode_buttons.forEach(function (button) {
        const selected = button.dataset.mode === mode;

        button.classList.toggle("active_mode", selected);
        button.setAttribute("aria-pressed", String(selected));
    });
};

const cell_button = function (row, column) {
    return game_board.querySelector(`[data-row="${row}"][data-column="${column}"]`);
};

const focus_cell = function (row, column) {
    const bounded_row = Math.max(0, Math.min(game.size - 1, row));
    const bounded_column = Math.max(0, Math.min(game.size - 1, column));
    const button = cell_button(bounded_row, bounded_column);

    focused_coordinate = {
        row: bounded_row,
        column: bounded_column
    };

    if (button !== null) {
        button.focus();
    }
};

const is_ready_to_split = function (cell) {
    return cell.owner !== null && cell.count === cell.capacity - 1;
};

const suggested_move = function () {
    const current_player = getCurrentPlayer(game);
    const legal_moves = getLegalMoves(game);

    return legal_moves.find(function (coordinate) {
        const cell = getCell(game, coordinate.row, coordinate.column);
        return cell.owner === current_player && is_ready_to_split(cell);
    }) ?? legal_moves.find(function (coordinate) {
        const cell = getCell(game, coordinate.row, coordinate.column);
        return cell.owner === null;
    }) ?? legal_moves[0] ?? null;
};

const ready_cells_for = function (state, player) {
    return getBoard(state).flat().filter(function (cell) {
        return cell.owner === player && is_ready_to_split(cell);
    }).length;
};

const evaluate_ai_move = function (move) {
    const before = getCell(game, move.row, move.column);
    const next = applyAction(game, {
        type: "placeOrb",
        row: move.row,
        column: move.column
    });
    const scores = calculateScores(next);
    const opponent = opponent_of(AI_PLAYER);
    const last_move = next.lastMove ?? {
        explosions: 0,
        cellsCaptured: 0
    };
    const centre = (game.size - 1) / 2;
    const distance_from_centre = (
        Math.abs(move.row - centre)
        + Math.abs(move.column - centre)
    );
    let score = 0;

    if (getStatus(next) === "won") {
        return getWinner(next) === AI_PLAYER ? 100000 : -100000;
    }

    score += (scores[AI_PLAYER].cells - scores[opponent].cells) * 90;
    score += (scores[AI_PLAYER].orbs - scores[opponent].orbs) * 14;
    score += last_move.explosions * 70;
    score += last_move.cellsCaptured * 170;
    score += ready_cells_for(next, AI_PLAYER) * 18;
    score -= ready_cells_for(next, opponent) * 24;

    if (before.owner === AI_PLAYER && is_ready_to_split(before)) {
        score += 240;
    }

    if (before.owner === null) {
        score += 20;
    }

    score += Math.max(0, 12 - distance_from_centre);
    score -= move.row * 0.01 + move.column * 0.001;

    return score;
};

const choose_ai_move = function () {
    const best = getLegalMoves(game).reduce(function (current_best, move) {
        const score = evaluate_ai_move(move);

        if (current_best === null || score > current_best.score) {
            return {
                move,
                score
            };
        }

        return current_best;
    }, null);

    return best === null ? null : best.move;
};

const make_pips = function (cell) {
    const pips = document.createElement("span");

    pips.className = "pips";
    pips.setAttribute("aria-hidden", "true");
    pips.replaceChildren(...Array.from({ length: cell.capacity }, function (_, index) {
        const pip = document.createElement("span");
        pip.className = index < cell.count ? "filled" : "";
        return pip;
    }));

    return pips;
};

const make_slime_image = function (cell, variant = "tile") {
    const wrap = document.createElement("span");
    const image = document.createElement("img");
    const count = document.createElement("span");

    wrap.className = `slime_art ${cell.owner} ${variant}_art`;
    wrap.setAttribute("aria-hidden", "true");
    image.src = PLAYER_IMAGES.tile[cell.owner];
    image.alt = "";
    count.className = "slime_count";
    count.textContent = String(cell.count);
    wrap.replaceChildren(image, count);

    return wrap;
};

const owner_label = function (owner) {
    if (owner === null) {
        return "Empty";
    }

    return owner === BLUE ? "Blue" : "Pink";
};

const describe_cell = function (cell, row, column) {
    const legal = isMoveLegal(game, row, column) ? "legal move" : "view only";

    return (
        `${formatCoordinate(row, column)}, ${owner_label(cell.owner)}, ` +
        `${cell.count} of ${cell.capacity}, ${legal}`
    );
};

const make_cell_button = function (cell, row, column) {
    const button = document.createElement("button");
    const coordinate = document.createElement("span");
    const content = document.createElement("span");
    const legal = isMoveLegal(game, row, column);
    const selected = (
        selected_coordinate !== null
        && selected_coordinate.row === row
        && selected_coordinate.column === column
    );
    const changed = (
        last_changed_coordinate !== null
        && last_changed_coordinate.row === row
        && last_changed_coordinate.column === column
    );

    button.type = "button";
    button.className = [
        "pond_cell",
        cell.owner ?? "empty",
        legal ? "legal_cell" : "",
        selected ? "selected_cell_button" : "",
        is_ready_to_split(cell) ? "ready_cell" : "",
        changed ? "changed_cell" : ""
    ].filter(Boolean).join(" ");
    button.dataset.row = String(row);
    button.dataset.column = String(column);
    button.disabled = ai_thinking || is_ai_turn();
    button.setAttribute("role", "gridcell");
    button.setAttribute("aria-label", describe_cell(cell, row, column));
    button.setAttribute("aria-selected", String(selected));

    coordinate.className = "coordinate";
    coordinate.textContent = formatCoordinate(row, column);
    content.className = "cell_content";

    if (cell.owner !== null) {
        content.append(make_slime_image(cell));
    }

    button.onclick = function () {
        play_cell(row, column);
    };

    button.onkeydown = function (event) {
        if (event.key === "Enter" || event.key === " " || event.key === "Space") {
            event.preventDefault();
            play_cell(row, column);
        }
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            focus_cell(row, column - 1);
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            focus_cell(row, column + 1);
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            focus_cell(row - 1, column);
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            focus_cell(row + 1, column);
        }
    };

    button.replaceChildren(coordinate, content, make_pips(cell));

    return button;
};

const render_board = function () {
    const board = getBoard(game);

    game_board.style.setProperty("--board-size", String(game.size));
    game_board.replaceChildren(...board.flatMap(function (row, row_index) {
        return row.map(function (cell, column_index) {
            return make_cell_button(cell, row_index, column_index);
        });
    }));
};

const make_dots = function (total, filled, class_name) {
    const dots = document.createElement("span");

    dots.className = `visual_dots ${class_name}`;
    dots.replaceChildren(...Array.from({ length: total }, function (_, index) {
        const dot = document.createElement("span");
        dot.className = index < filled ? "filled" : "";
        return dot;
    }));

    return dots;
};

const visual_row = function (label, dots) {
    const row = document.createElement("div");
    const text = document.createElement("span");

    row.className = "visual_row";
    text.textContent = label;
    row.replaceChildren(text, dots);

    return row;
};

const render_selected_cell = function () {
    if (selected_coordinate === null) {
        const empty = document.createElement("span");

        empty.className = "empty_state";
        empty.textContent = "Select a pond tile.";
        selected_cell.replaceChildren(empty);
        return;
    }

    const cell = getCell(game, selected_coordinate.row, selected_coordinate.column);
    const title = document.createElement("strong");
    const owner = document.createElement("span");
    const preview = document.createElement("span");
    const details = document.createElement("div");
    const action = document.createElement("span");

    title.textContent = formatCoordinate(selected_coordinate.row, selected_coordinate.column);
    owner.className = `owner_pill ${cell.owner ?? "neutral"}`;
    owner.textContent = owner_label(cell.owner);
    preview.className = "selected_preview";

    if (cell.owner !== null) {
        preview.append(make_slime_image(cell, "preview"));
    }

    details.className = "selected_details";
    details.replaceChildren(
        visual_row("Capacity", make_dots(cell.capacity, cell.capacity, "capacity_dots")),
        visual_row("Slimes", make_dots(cell.capacity, cell.count, "slime_dots"))
    );

    action.className = isMoveLegal(game, selected_coordinate.row, selected_coordinate.column)
        ? "next_action legal_action"
        : "next_action view_action";
    action.textContent = isMoveLegal(game, selected_coordinate.row, selected_coordinate.column)
        ? cell.count === cell.capacity - 1 ? "+1 -> Split" : "+1"
        : "View only";

    selected_cell.replaceChildren(title, owner, preview, details, action);
};

const combo_label = function (explosions) {
    if (explosions >= 6) {
        return `MEGA CHAIN x${explosions}`;
    }
    if (explosions >= 3) {
        return `SLIME COMBO x${explosions}`;
    }
    if (explosions > 0) {
        return "SLIME SPLIT";
    }
    return "";
};

const show_combo = function (explosions) {
    const label = combo_label(explosions);

    combo_pop.textContent = label;
    combo_pop.classList.toggle("show_combo", label !== "");

    if (label !== "") {
        window.setTimeout(function () {
            combo_pop.classList.remove("show_combo");
        }, 900);
    }
};

const render_stats = function () {
    const scores = calculateScores(game);
    const stats = getStats(game);
    const current_player = getCurrentPlayer(game);
    const winner = getWinner(game);
    const playing = getStatus(game) === "playing";
    const ai_active = playing && is_ai_turn();

    document.body.classList.toggle("ai_thinking", ai_thinking);
    turn_value.textContent = String(game.turn);
    blue_tiles.textContent = String(scores[BLUE].cells);
    red_tiles.textContent = String(scores[RED].cells);
    largest_chain.textContent = String(stats.largestChainReaction);
    cells_captured.textContent = String(stats.cellsCaptured);
    turn_banner.className = `turn_banner ${current_player === BLUE ? "blue_turn" : "pink_turn"}`;
    turn_image.src = PLAYER_IMAGES.leader[current_player];
    turn_title.textContent = playing
        ? ai_active
            ? "Pink AI's Turn"
            : `${current_player === BLUE ? "Blue" : "Pink"}'s Turn`
        : `${player_name(winner)} Wins`;
    turn_copy.textContent = playing
        ? ai_active
            ? "Slime Master is choosing a move."
            : "Choose an empty pond or one of your own slimes."
        : "The match is over. Play again, undo, or restart.";
    status_output.value = board_message;
    assistant_tip.textContent = playing
        ? ai_active
            ? "AI is thinking..."
            : selected_coordinate === null
            ? "Pick a glowing tile."
            : isMoveLegal(game, selected_coordinate.row, selected_coordinate.column)
                ? "One more slime!"
                : "Choose your own slime."
        : `${player_name(winner)} wins!`;
    hint_button.disabled = ai_active || ai_thinking;
    undo_button.disabled = game.history.length === 0 || ai_thinking;
};

const render_game_over = function () {
    const winner = getWinner(game);
    const stats = getStats(game);
    const scores = calculateScores(game);

    if (getStatus(game) !== "won" || winner === null || game_over_dialog.open) {
        return;
    }

    winner_image.src = PLAYER_IMAGES.leader[winner];
    game_over_title.textContent = `${winner === BLUE ? "Blue" : "Pink"} Slimes Win`;
    game_over_copy.textContent = `${player_name(winner)} claimed the pond.`;
    final_score.textContent = String(scores[winner].cells);
    final_turns.textContent = String(stats.totalTurns);
    final_chain.textContent = String(stats.largestChainReaction);
    final_captures.textContent = String(stats.cellsCaptured);
    game_over_dialog.showModal();
};

const render = function () {
    render_board();
    render_selected_cell();
    render_stats();
    render_game_over();
};

const take_ai_turn = function () {
    ai_timer = null;

    if (!is_ai_turn()) {
        ai_thinking = false;
        render();
        return;
    }

    const move = choose_ai_move();

    if (move === null) {
        ai_thinking = false;
        board_message = "Slime Master has no legal move.";
        render();
        return;
    }

    selected_coordinate = move;
    focused_coordinate = move;
    game = applyAction(game, {
        type: "placeOrb",
        row: move.row,
        column: move.column
    });
    last_changed_coordinate = move;
    ai_thinking = false;
    board_message = getStatus(game) === "playing"
        ? `${player_name(getCurrentPlayer(game))}'s turn.`
        : `${player_name(getWinner(game))} wins!`;
    render();
    show_combo(game.lastMove?.explosions ?? 0);
    focus_cell(move.row, move.column);
};

const schedule_ai_turn = function () {
    if (!is_ai_turn() || ai_thinking) {
        return;
    }

    ai_thinking = true;
    board_message = "Slime Master is choosing a move.";
    render();
    ai_timer = window.setTimeout(take_ai_turn, AI_DELAY_MS);
};

const start_game = function () {
    clear_ai_timer();

    if (game_over_dialog.open) {
        game_over_dialog.close();
    }

    game = createGame({ difficulty: "medium" });
    selected_coordinate = null;
    focused_coordinate = { row: 0, column: 0 };
    last_changed_coordinate = null;
    board_message = selected_mode === "ai"
        ? "Blue starts a Slime Master challenge."
        : "Blue starts a friendly pond battle.";
    show_screen(game_screen);
    render();
    focus_cell(0, 0);
};

function play_cell(row, column) {
    if (ai_thinking || is_ai_turn()) {
        board_message = "Slime Master is choosing a move.";
        schedule_ai_turn();
        render();
        return;
    }

    selected_coordinate = { row, column };
    focused_coordinate = { row, column };

    if (getStatus(game) !== "playing") {
        render_game_over();
        return;
    }

    if (!isMoveLegal(game, row, column)) {
        last_changed_coordinate = null;
        board_message = "Rival pond selected. Pick an empty or friendly pond.";
        render();
        focus_cell(row, column);
        return;
    }

    game = applyAction(game, {
        type: "placeOrb",
        row,
        column
    });
    last_changed_coordinate = { row, column };
    board_message = `${player_name(getCurrentPlayer(game))}'s turn.`;
    render();
    show_combo(game.lastMove?.explosions ?? 0);

    if (is_ai_turn()) {
        schedule_ai_turn();
    } else {
        focus_cell(row, column);
    }
}

play_button.onclick = start_game;
how_to_play_button.onclick = () => rules_dialog.showModal();
help_tool_button.onclick = () => rules_dialog.showModal();
settings_button.onclick = () => settings_dialog.showModal();
settings_tool_button.onclick = () => settings_dialog.showModal();
home_tool_button.onclick = function () {
    clear_ai_timer();
    show_screen(landing_screen);
};
music_button.onclick = function () {
    sound_on = !sound_on;
    music_button.classList.toggle("muted", !sound_on);
};

mode_buttons.forEach(function (button) {
    button.onclick = function () {
        set_mode(button.dataset.mode);
    };
});

hint_button.onclick = function () {
    if (ai_thinking || is_ai_turn()) {
        return;
    }

    const move = suggested_move();

    if (move === null) {
        return;
    }

    selected_coordinate = move;
    board_message = `Try ${formatCoordinate(move.row, move.column)}.`;
    render();
    focus_cell(move.row, move.column);
};

undo_button.onclick = function () {
    let previous = undo(game);

    clear_ai_timer();

    if (
        is_ai_mode()
        && getCurrentPlayer(previous) === AI_PLAYER
        && previous.history.length > 0
    ) {
        previous = undo(previous);
    }

    game = previous;
    selected_coordinate = null;
    last_changed_coordinate = null;
    board_message = "Move undone.";
    render();
    focus_cell(0, 0);
};

restart_button.onclick = function () {
    clear_ai_timer();
    game = restart(game);
    selected_coordinate = null;
    focused_coordinate = { row: 0, column: 0 };
    last_changed_coordinate = null;
    board_message = "Game restarted.";
    render();
    focus_cell(0, 0);
};

play_again_button.onclick = start_game;
home_after_game_button.onclick = function () {
    clear_ai_timer();
    game_over_dialog.close();
    show_screen(landing_screen);
};

high_contrast_toggle.onchange = function () {
    document.body.classList.toggle("high_contrast", high_contrast_toggle.checked);
};
colour_blind_toggle.onchange = function () {
    document.body.classList.toggle("colour_blind", colour_blind_toggle.checked);
};
reduced_motion_toggle.onchange = function () {
    document.body.classList.toggle("gentle_motion", reduced_motion_toggle.checked);
};

set_mode("ai");
