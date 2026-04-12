// ui.js - Handles all DOM manipulation and CSS changes

// --- Audio Manager ---
const sounds = {
  move: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/move-self.mp3'),
  capture: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/capture.mp3'),
  blunder: new Audio('https://images.chesscomfiles.com/chess-themes/sounds/_MP3_/default/notify.mp3'),
};

/** Play an audio cue and trigger mobile haptics. type: 'move' | 'capture' | 'blunder' */
export function playFeedback(type) {
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch(() => {});
  }
  if (navigator.vibrate) {
    navigator.vibrate(type === 'capture' || type === 'blunder' ? [20] : [10]);
  }
}

export function updateCoach(title, text, sentiment) {
  $("#coach-title").html(title);
  $("#coach-text").html(text);

  let color = "#ffd700"; // Neutral (Yellow)
  if (sentiment === "bad") color = "#ff4444"; // Red
  if (sentiment === "good") color = "#4CAF50"; // Green

  $(".coach-bubble").css("border-left-color", color);
  $("#coach-title").css("color", color);
}

/** Initialize tab switching for Coach / Analysis views. */
export function initTabs() {
  $(".tab-btn").on("click", function () {
    const targetId = $(this).data("target");
    $(".tab-btn").removeClass("active");
    $(this).addClass("active");
    $(".tab-content").removeClass("active").hide();
    $("#" + targetId).addClass("active").show();
  });
}

/** Update the raw Analysis tab with engine stats. */
export function updateAnalysisView(scoreStr, depth, bestLineUci) {
  $("#analysis-eval").text(scoreStr || "0.00");
  $("#analysis-depth").text("Depth " + (depth || 0));
  $("#analysis-line").text(bestLineUci || "Waiting for engine...");
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

/** Show panel to choose which player's moves to analyze. onSelect('white'|'black'|'both') when chosen. */
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
  $("#btnAnalyzeBoth").off("click").on("click", function () {
    $("#player-choice-panel").hide();
    onSelect("both");
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

  if (analyzeForColor === "white" || analyzeForColor === "both") {
    bottomName.text(wLabel);
    topName.text(bLabel);
  } else {
    bottomName.text(bLabel);
    topName.text(wLabel);
  }

  if (analyzeForColor === "both") {
    $(".bottom-player").addClass("is-analyzing");
    $(".top-player").addClass("is-analyzing");
  } else {
    $(".bottom-player").addClass("is-analyzing");
    $(".top-player").removeClass("is-analyzing");
  }
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
/** Highlight the active move in the move list and safely scroll ONLY the container. */
export function highlightActiveMove(moveIndex) {
  $(".move-list-body .move-active").removeClass("move-active");

  if (moveIndex < 0) return;

  const target = $(`.move-list-body [data-move-index="${moveIndex}"]`);
  if (target.length) {
    target.addClass("move-active");

    // Safely scroll the container without moving the parent window
    const container = $(".move-list-body");

    // Calculate the position relative to the container's current scroll
    const scrollPos =
      container.scrollTop() +
      target.position().top -
      container.height() / 2 +
      target.height() / 2;

    // Stop any current scrolling animation and smoothly scroll to the new target
    container.stop().animate({ scrollTop: scrollPos }, 150);
  }
}

/** Add a classification icon badge to a move in the move list. */
export function addMoveClassificationIcon(moveIndex, classification) {
  const target = $(".move-list-body").find(`[data-move-index="${moveIndex}"]`);
  if (!target.length) return;

  // Remove existing icon to prevent duplicates
  target.find(".move-icon").remove();

  const iconMap = {
    blunder:    '<span class="move-icon icon-blunder">✖</span>',
    mistake:    '<span class="move-icon icon-mistake">⁇</span>',
    inaccuracy: '<span class="move-icon icon-inaccuracy">⁈</span>',
    best:       '<span class="move-icon icon-best">⭐</span>',
    good:       '<span class="move-icon icon-good">👍</span>',
  };

  const html = iconMap[classification];
  if (html) target.append(html);
}

/** Update the clock displays for both players. */
export function updateClocks(whiteTimeStr, blackTimeStr, analyzeForColor) {
  const topClock = $(".top-player .clock-display");
  const bottomClock = $(".bottom-player .clock-display");

  const wTime = whiteTimeStr || "--:--";
  const bTime = blackTimeStr || "--:--";

  if (analyzeForColor === "black") {
    bottomClock.text(bTime);
    topClock.text(wTime);
  } else {
    // Default or "white": White at bottom
    bottomClock.text(wTime);
    topClock.text(bTime);
  }
}

/** Update material advantage badges next to player names. */
export function updateMaterial(whiteAdvantage, blackAdvantage, analyzeForColor) {
  const topScore = $(".top-player .material-score");
  const bottomScore = $(".bottom-player .material-score");

  const wText = whiteAdvantage > 0 ? "+" + whiteAdvantage : "";
  const bText = blackAdvantage > 0 ? "+" + blackAdvantage : "";

  if (analyzeForColor === "black") {
    bottomScore.text(bText);
    topScore.text(wText);
  } else {
    bottomScore.text(wText);
    topScore.text(bText);
  }
}

/** Render captured piece icons inside the player profile bars. */
export function updateCapturedPieces(capturedByWhite, capturedByBlack, analyzeForColor) {
  const imgBase = "https://chessboardjs.com/img/chesspieces/wikipedia/";

  function renderPieces(pieces, capturedColor) {
    // pieces = array of piece types like ['q','r','p']
    // capturedColor = 'b' if White captured them (black pieces), 'w' if Black captured them
    return pieces
      .map((type) => {
        const code = capturedColor + type.toUpperCase(); // e.g. "bP", "wN"
        return `<img src="${imgBase}${code}.png" alt="${code}">`;
      })
      .join("");
  }

  // capturedByWhite = black pieces that White captured → show near White's profile
  // capturedByBlack = white pieces that Black captured → show near Black's profile
  const whiteCapturedHtml = renderPieces(capturedByWhite, "b");
  const blackCapturedHtml = renderPieces(capturedByBlack, "w");

  if (analyzeForColor === "black") {
    $(".bottom-player .captured-pieces").html(whiteCapturedHtml);
    $(".top-player .captured-pieces").html(blackCapturedHtml);
  } else {
    $(".bottom-player .captured-pieces").html(whiteCapturedHtml);
    $(".top-player .captured-pieces").html(blackCapturedHtml);
  }
}

/** Render the post-game scorecard tallying classification counts and accuracy. */
export function renderScorecard(whiteCounts, blackCounts, whiteAccuracy, blackAccuracy) {
  const rows = [
    { key: "best",       label: "BEST MOVE",   icon: "⭐", cls: "icon-best" },
    { key: "good",       label: "GOOD",         icon: "👍", cls: "icon-good" },
    { key: "inaccuracy", label: "INACCURACY",   icon: "⁈",  cls: "icon-inaccuracy" },
    { key: "mistake",    label: "MISTAKE",      icon: "⁇",  cls: "icon-mistake" },
    { key: "blunder",    label: "BLUNDER",      icon: "✖",  cls: "icon-blunder" },
  ];

  let html = `
    <div class="scorecard-header">
      <div>
        <div class="acc-val">${whiteAccuracy}%</div>
        <div class="acc-label">White Accuracy</div>
      </div>
      <div>
        <div class="acc-val">${blackAccuracy}%</div>
        <div class="acc-label">Black Accuracy</div>
      </div>
    </div>
  `;

  for (const r of rows) {
    const w = whiteCounts[r.key] || 0;
    const b = blackCounts[r.key] || 0;
    html += `
      <div class="scorecard-row">
        <div class="sc-val">${w}</div>
        <div class="sc-label"><span class="move-icon ${r.cls}">${r.icon}</span> ${r.label}</div>
        <div class="sc-val">${b}</div>
      </div>
    `;
  }

  $("#scorecard-container").html(html);
}

/** Draw an SVG arrow using exact bounding boxes to prevent a8 origin bugs. */
export function drawArrow(fromSquare, toSquare, type = "engine") {
  const fromEl = document.querySelector(`#board .square-${fromSquare}`);
  const toEl = document.querySelector(`#board .square-${toSquare}`);
  const boardStack = document.getElementById("board-stack");
  if (!fromEl || !toEl || !boardStack) return;

  const stackRect = boardStack.getBoundingClientRect();
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();

  const startX = fromRect.left - stackRect.left + fromRect.width / 2;
  const startY = fromRect.top - stackRect.top + fromRect.height / 2;
  const endX = toRect.left - stackRect.left + toRect.width / 2;
  const endY = toRect.top - stackRect.top + toRect.height / 2;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", startX);
  line.setAttribute("y1", startY);
  line.setAttribute("x2", endX);
  line.setAttribute("y2", endY);
  line.setAttribute("class", `arrow-line arrow-${type}`);

  $("#arrow-overlay").append(line);
}

/** Clear arrows from the SVG overlay. Pass type to clear only engine or user arrows. */
export function clearArrows(type) {
  if (type) {
    $(`#arrow-overlay .arrow-${type}`).remove();
  } else {
    $("#arrow-overlay line").remove();
  }
}

/** Mathematically find which square physically contains the x/y pixel. */
export function getSquareFromCoords(x, y) {
  let foundSquare = null;
  const squares = document.querySelectorAll("#board [class*='square-']");

  for (let i = 0; i < squares.length; i++) {
    const rect = squares[i].getBoundingClientRect();
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      const classes = Array.from(squares[i].classList);
      // THE FIX: Strictly match 'square-' followed by a valid chess coordinate (a-h, 1-8)
      const sqClass = classes.find((c) => /^square-[a-h][1-8]$/.test(c));
      if (sqClass) {
        foundSquare = sqClass.split("-")[1];
        break;
      }
    }
  }
  return foundSquare;
}
