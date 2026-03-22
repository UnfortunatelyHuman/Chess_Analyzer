// ui.js - Handles all DOM manipulation and CSS changes

export function updateCoach(title, text, sentiment) {
  $("#coach-title").html(title);
  $("#coach-text").html(text);

  let color = "#ffd700"; // Neutral (Yellow)
  if (sentiment === "bad") color = "#ff4444"; // Red
  if (sentiment === "good") color = "#4CAF50"; // Green

  $(".coach-bubble").css("border-left-color", color);
  $("#coach-title").css("color", color);
}

export function updateEvalBar(score) {
  // Clamp visual score between -5 and +5
  let visualScore = Math.max(-5, Math.min(5, score));
  // Calculate percentage (0% = Black +5, 50% = Equal, 100% = White +5)
  let percent = ((visualScore + 5) / 10) * 100;

  $("#eval-fill").css("height", percent + "%");

  // Format the text label (4-digit style e.g. 10.01, -5.20)
  let label = score > 0 ? "+" + score.toFixed(2) : score.toFixed(2);
  $("#eval-score").text(label);

  // Position the score label to ride just above the fill line
  // Clamp so it doesn't clip off the top or bottom of the bar
  let scoreBottom = Math.max(2, Math.min(percent - 5, 90));
  $("#eval-score").css("bottom", scoreBottom + "%");
}

export function toggleSetupMenu() {
  $("#setup-area").slideToggle();
}

export function hideSetupMenu() {
  $("#setup-area").hide();
}

const SUGGESTED_CLASS = "suggested-move";
const LAST_MOVE_CLASS = "last-move";

/** Highlight the suggested (engine) best move on the board. uciMove is e.g. "e2e4" or "e7e8q". */
export function highlightSuggestedMove(uciMove) {
  if (!uciMove || uciMove.length < 4) return;
  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  $(`#board .${SUGGESTED_CLASS}`).removeClass(`${SUGGESTED_CLASS} suggested-from suggested-to`);
  $(`#board .square-${from}`).addClass(`${SUGGESTED_CLASS} suggested-from`);
  $(`#board .square-${to}`).addClass(`${SUGGESTED_CLASS} suggested-to`);
}

/** Remove suggested-move highlights from the board. */
export function clearSuggestedMoveHighlight() {
  $(`#board .${SUGGESTED_CLASS}`).removeClass(`${SUGGESTED_CLASS} suggested-from suggested-to`);
}

/** Highlight the current/last played move on the board (from and to squares). */
export function highlightLastMove(fromSquare, toSquare) {
  $(`#board .${LAST_MOVE_CLASS}`).removeClass(`${LAST_MOVE_CLASS} last-move-from last-move-to`);
  if (fromSquare && toSquare) {
    $(`#board .square-${fromSquare}`).addClass(`${LAST_MOVE_CLASS} last-move-from`);
    $(`#board .square-${toSquare}`).addClass(`${LAST_MOVE_CLASS} last-move-to`);
  }
}

/** Remove last-move highlight from the board. */
export function clearLastMoveHighlight() {
  $(`#board .${LAST_MOVE_CLASS}`).removeClass(`${LAST_MOVE_CLASS} last-move-from last-move-to`);
}

/** Show panel to choose which player's moves to analyze. onSelect('white'|'black') when chosen. */
export function showPlayerChoice(whiteName, blackName, onSelect) {
  const w = whiteName && whiteName.trim() ? `White: ${whiteName.trim()}` : "White";
  const b = blackName && blackName.trim() ? `Black: ${blackName.trim()}` : "Black";
  $("#btnAnalyzeWhite").text(w).attr("title", w);
  $("#btnAnalyzeBlack").text(b).attr("title", b);
  $("#player-choice-panel").show();
  $("#btnAnalyzeWhite").off("click").on("click", function () {
    $("#player-choice-panel").hide();
    onSelect("white");
  });
  $("#btnAnalyzeBlack").off("click").on("click", function () {
    $("#player-choice-panel").hide();
    onSelect("black");
  });
}

/** Hide the player choice panel. */
export function hidePlayerChoice() {
  $("#player-choice-panel").hide();
}

/** Update both player profile bars (top = opponent, bottom = you). */
export function updateBoardPlayerLabels(whiteName, blackName, analyzeForColor) {
  const topName = $(".top-player .player-name");
  const bottomName = $(".bottom-player .player-name");

  const wLabel = whiteName && whiteName.trim() ? whiteName.trim() : "White";
  const bLabel = blackName && blackName.trim() ? blackName.trim() : "Black";

  if (!analyzeForColor) {
    // Default: White at bottom, Black at top
    bottomName.text(wLabel);
    topName.text(bLabel);
    $(".bottom-player").removeClass("is-analyzing");
    $(".top-player").removeClass("is-analyzing");
    return;
  }

  if (analyzeForColor === "white") {
    bottomName.text(wLabel);
    topName.text(bLabel);
  } else {
    bottomName.text(bLabel);
    topName.text(wLabel);
  }
  $(".bottom-player").addClass("is-analyzing");
  $(".top-player").removeClass("is-analyzing");
}

/** Render the move list from the parsed PGN moves array (chess.js verbose history). */
export function renderMoveList(moves) {
  const body = $(".move-list-body");
  body.empty();

  for (let i = 0; i < moves.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const whiteMove = moves[i];
    const blackMove = i + 1 < moves.length ? moves[i + 1] : null;

    const row = $('<div class="move-row"></div>');
    row.append(`<span class="move-number">${moveNum}.</span>`);
    row.append(
      `<span class="move-white" data-move-index="${i}">${whiteMove.san}</span>`
    );
    if (blackMove) {
      row.append(
        `<span class="move-black" data-move-index="${i + 1}">${blackMove.san}</span>`
      );
    } else {
      row.append('<span class="move-black"></span>');
    }
    body.append(row);
  }
}

/** Highlight the active move in the move list and scroll it into view. */
export function highlightActiveMove(moveIndex) {
  $(".move-list-body .move-active").removeClass("move-active");

  if (moveIndex < 0) return;

  const target = $(`.move-list-body [data-move-index="${moveIndex}"]`);
  if (target.length) {
    target.addClass("move-active");
    target[0].scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
