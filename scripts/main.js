// main.js - The Controller

import { initEngine, analyzePosition } from "./engine.js";
import {
  updateCoach,
  updateEvalBar,
  toggleSetupMenu,
  hideSetupMenu,
  highlightSuggestedMove,
  clearSuggestedMoveHighlight,
  highlightLastMove,
  clearLastMoveHighlight,
  showPlayerChoice,
  hidePlayerChoice,
  updateBoardPlayerLabels,
  renderMoveList,
  highlightActiveMove,
  updateClocks,
  updateMaterial,
  addMoveClassificationIcon,
  initTabs,
  updateAnalysisView,
} from "./ui.js";

let board = null;
let game = new Chess();
let moves = [];
let clockTimes = [];
let moveClassifications = [];
let currentMoveIndex = 0;
let currentEval = 0.0;
let prevEval = 0.0;
/** Which side we analyze: 'white' | 'black'. Set when user chooses after PGN load. */
let analyzeForColor = null;
/** Player names from PGN headers. */
let whitePlayerName = "";
let blackPlayerName = "";
/** True when we're waiting for engine's best move from the position BEFORE selected player's move (so we can show "what they should have played"). */
let pendingSelectedPlayerMove = false;
/** After we get that best move, we request eval for current position; this is true until we get the second bestmove. */
let waitingForEvalAfterSelectedMove = false;
/** Selected player's best move (from position before their move), used for highlight and for generateAdvice. */
let storedSelectedPlayerBestMove = null;

$(document).ready(function () {
  initEngine(handleEngineMessage);

  board = Chessboard("board", {
    position: "start",
    draggable: false,
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
    moveSpeed: 500,
    appearSpeed: 500,
  });

  $(window).resize(board.resize);
  $("#btnFirst").on("click", function () { jumpToStart(); });
  $("#btnNext").on("click", nextMove);
  $("#btnPrev").on("click", prevMove);
  $("#btnLast").on("click", function () { if (moves.length > 0) jumpToMove(moves.length - 1); });
  $("#btnFlip").on("click", flipBoard);
  $("#btnLoad").on("click", loadGame);
  $("#toggle-setup").on("click", toggleSetupMenu);
  initTabs();

  // Keyboard navigation: Arrow keys
  $(document).on("keydown", function (e) {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      nextMove();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevMove();
    }
  });

  // Clickable move list: jump to any move
  $(".move-list-body").on("click", ".move-white, .move-black", function () {
    const idx = parseInt($(this).attr("data-move-index"), 10);
    if (!isNaN(idx)) jumpToMove(idx);
  });
});

// --- CORE GAME CONTROLS ---

/** Parse PGN headers for White and Black player names. */
function parsePgnHeaders(pgn) {
  const whiteMatch = pgn.match(/\[\s*White\s+"([^"]*)"\s*\]/i);
  const blackMatch = pgn.match(/\[\s*Black\s+"([^"]*)"\s*\]/i);
  return {
    white: whiteMatch ? whiteMatch[1].trim() : "",
    black: blackMatch ? blackMatch[1].trim() : "",
  };
}

function loadGame() {
  let pgn = $("#pgnInput").val();

  // Remove extra spaces from start/end
  pgn = pgn.trim();

  // Ensure there is an empty line between headers and moves
  // We look for the last bracket ']' and the first move '1.'
  if (!pgn.includes("\n\n") && pgn.includes("]")) {
    // This adds a double line-break after the last ']'
    pgn = pgn.replace(/]\s*(1\.)/, "]\n\n$1");
  }
  if (game.load_pgn(pgn)) {
    moves = game.history({ verbose: true });
    game.reset();
    board.position("start");
    currentMoveIndex = 0;
    currentEval = 0.0;
    prevEval = 0.0;
    analyzeForColor = null;

    // Parse [%clk H:MM:SS] tags from the raw PGN
    const clkMatches = [...pgn.matchAll(/\[%clk\s+([^\]]+)\]/g)];
    clockTimes = clkMatches.map((m) => m[1].trim());
    moveClassifications = [];

    const names = parsePgnHeaders(pgn);
    whitePlayerName = names.white;
    blackPlayerName = names.black;

    updateCoach(
      "Game Loaded",
      "Choose which player's moves to analyze (above), then click Next Move.",
      "neutral",
    );
    updateEvalBar(0);
    clearSuggestedMoveHighlight();
    clearLastMoveHighlight();
    hideSetupMenu();
    renderMoveList(moves);
    highlightActiveMove(-1);
    syncClocks(-1);
    syncMaterial();
    updateBoardPlayerLabels(whitePlayerName, blackPlayerName, null);
    showPlayerChoice(whitePlayerName, blackPlayerName, function (color) {
      analyzeForColor = color;
      board.orientation(analyzeForColor);
      updateBoardPlayerLabels(whitePlayerName, blackPlayerName, analyzeForColor);
      syncClocks(-1);
      syncMaterial();
      updateCoach(
        "Ready",
        analyzeForColor === "white" ? "Analyzing White's moves. Click Next Move to start." : "Analyzing Black's moves. Click Next Move to start.",
        "neutral",
      );
    });
  } else {
    updateCoach(
      "Error",
      "That PGN looks invalid. Please check the text and try again.",
      "bad",
    );
  }
}

function nextMove() {
  clearSuggestedMoveHighlight();
  if (currentMoveIndex >= moves.length) {
    updateCoach("End of Game", "That's all the moves! How did you do?", "good");
    return;
  }

  const move = moves[currentMoveIndex];
  const isSelectedPlayerMove =
    analyzeForColor &&
    ((analyzeForColor === "white" && currentMoveIndex % 2 === 0) ||
      (analyzeForColor === "black" && currentMoveIndex % 2 === 1));

  if (isSelectedPlayerMove) {
    const savedFen = game.fen();
    game.move(move.san);
    board.position(game.fen(), true);
    currentMoveIndex++;
    highlightLastMove(move.from, move.to);
    highlightActiveMove(currentMoveIndex - 1);
    syncClocks(currentMoveIndex - 1);
    syncMaterial();
    pendingSelectedPlayerMove = true;
    updateCoach("Thinking...", "Finding the best move for you...", "neutral");
    analyzePosition(savedFen);
    return;
  }

  game.move(move.san);
  board.position(game.fen(), true);
  currentMoveIndex++;
  highlightLastMove(move.from, move.to);
  highlightActiveMove(currentMoveIndex - 1);
  syncClocks(currentMoveIndex - 1);
  syncMaterial();
  updateCoach("Thinking...", "Calculating the best moves...", "neutral");
  analyzePosition(game.fen());
}

function prevMove() {
  clearSuggestedMoveHighlight();
  pendingSelectedPlayerMove = false;
  waitingForEvalAfterSelectedMove = false;
  storedSelectedPlayerBestMove = null;
  if (currentMoveIndex > 0) {
    game.undo();
    board.position(game.fen(), true);
    currentMoveIndex--;
    highlightActiveMove(currentMoveIndex - 1);
    syncClocks(currentMoveIndex - 1);
    syncMaterial();
    if (currentMoveIndex > 0) {
      const prevMove = moves[currentMoveIndex - 1];
      highlightLastMove(prevMove.from, prevMove.to);
    } else {
      clearLastMoveHighlight();
    }
    updateCoach(
      "Rewind",
      "Let's take a look at the previous position.",
      "neutral",
    );
    analyzePosition(game.fen());
  }
}

function jumpToMove(targetIndex) {
  // Clear any pending engine state
  clearSuggestedMoveHighlight();
  pendingSelectedPlayerMove = false;
  waitingForEvalAfterSelectedMove = false;
  storedSelectedPlayerBestMove = null;

  // Replay from start up to and including targetIndex
  game.reset();
  for (let i = 0; i <= targetIndex; i++) {
    game.move(moves[i].san);
  }

  board.position(game.fen(), false);
  currentMoveIndex = targetIndex + 1;

  // Highlight the move in the list
  highlightActiveMove(targetIndex);

  // Highlight the last played move on the board
  const lastMove = moves[targetIndex];
  highlightLastMove(lastMove.from, lastMove.to);

  // Sync clocks and trigger engine analysis
  syncClocks(targetIndex);
  syncMaterial();
  updateCoach("Thinking...", "Analyzing this position...", "neutral");
  analyzePosition(game.fen());
}

/** Jump back to the starting position. */
function jumpToStart() {
  clearSuggestedMoveHighlight();
  clearLastMoveHighlight();
  pendingSelectedPlayerMove = false;
  waitingForEvalAfterSelectedMove = false;
  storedSelectedPlayerBestMove = null;

  game.reset();
  board.position("start", false);
  currentMoveIndex = 0;
  highlightActiveMove(-1);
  syncClocks(-1);
  syncMaterial();
  updateCoach("Start", "Back to the beginning. Click Next Move to step through.", "neutral");
  analyzePosition(game.fen());
}

/** Flip the board and swap the UI orientation. */
function flipBoard() {
  board.flip();
  // Toggle analyzeForColor orientation
  if (analyzeForColor === "white") {
    analyzeForColor = "black";
  } else if (analyzeForColor === "black") {
    analyzeForColor = "white";
  }
  updateBoardPlayerLabels(whitePlayerName, blackPlayerName, analyzeForColor);
  syncClocks(currentMoveIndex - 1);
  syncMaterial();
}

/** Calculate material totals from the current board position. */
function calculateMaterial() {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  let whiteTotal = 0;
  let blackTotal = 0;

  const boardArr = game.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = boardArr[row][col];
      if (sq && pieceValues[sq.type]) {
        if (sq.color === "w") {
          whiteTotal += pieceValues[sq.type];
        } else {
          blackTotal += pieceValues[sq.type];
        }
      }
    }
  }

  const diff = whiteTotal - blackTotal;
  return {
    whiteAdvantage: diff > 0 ? diff : 0,
    blackAdvantage: diff < 0 ? -diff : 0,
  };
}

/** Sync the material advantage badges. */
function syncMaterial() {
  const mat = calculateMaterial();
  updateMaterial(mat.whiteAdvantage, mat.blackAdvantage, analyzeForColor);
}

/** Look through clockTimes to find the most recent White & Black times up to index. */
function syncClocks(index) {
  let whiteTime = null;
  let blackTime = null;

  if (index < 0 || clockTimes.length === 0) {
    // Starting position — use first available times or fallback
    whiteTime = clockTimes.length > 0 ? clockTimes[0] : "10:00";
    blackTime = clockTimes.length > 1 ? clockTimes[1] : "10:00";
    updateClocks(whiteTime, blackTime, analyzeForColor);
    return;
  }

  // clockTimes[i] corresponds to moves[i]
  // Even indices (0, 2, 4...) = White's clock after their move
  // Odd indices (1, 3, 5...) = Black's clock after their move
  for (let i = 0; i <= index && i < clockTimes.length; i++) {
    if (i % 2 === 0) {
      whiteTime = clockTimes[i];
    } else {
      blackTime = clockTimes[i];
    }
  }

  updateClocks(whiteTime || "--:--", blackTime || "--:--", analyzeForColor);
}

// --- ENGINE TRANSLATION & COACHING ---

function handleEngineMessage(msg) {
  // Parse "info depth" lines for the Analysis tab
  if (msg.startsWith("info depth")) {
    const depthMatch = msg.match(/depth (\d+)/);
    const pvMatch = msg.match(/pv (.*)/);
    const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
    const pv = pvMatch ? pvMatch[1].trim() : "";

    // Extract score (cp or mate) for Analysis view
    let formattedScore = "0.00";
    const cpMatch = msg.match(/score cp (-?\d+)/);
    const mateMatch = msg.match(/score mate (-?\d+)/);

    if (cpMatch) {
      let cp = parseInt(cpMatch[1]);
      let evalInPawns = cp / 100;
      if (game.turn() === "b") evalInPawns = -evalInPawns;
      formattedScore = (evalInPawns > 0 ? "+" : "") + evalInPawns.toFixed(2);

      // Also update eval bar and currentEval (only if not in pending state)
      if (!pendingSelectedPlayerMove) {
        currentEval = evalInPawns;
        updateEvalBar(currentEval);
      }
    } else if (mateMatch) {
      let mateIn = parseInt(mateMatch[1]);
      let absoluteMate = game.turn() === "b" ? -mateIn : mateIn;
      formattedScore = (absoluteMate > 0 ? "+" : "") + "M" + Math.abs(mateIn);

      if (!pendingSelectedPlayerMove) {
        updateEvalBar(absoluteMate > 0 ? 10 : -10);
      }
    }

    updateAnalysisView(formattedScore, depth, pv);
    return;
  }

  // Handle score cp (from non-"info depth" lines, legacy fallback)
  if (msg.includes("score cp")) {
    if (pendingSelectedPlayerMove) return;
    let match = msg.match(/score cp (-?\d+)/);
    if (match) {
      let cp = parseInt(match[1]);
      let evalInPawns = cp / 100;
      if (game.turn() === "b") evalInPawns = -evalInPawns;
      currentEval = evalInPawns;
      updateEvalBar(currentEval);
    }
  } else if (msg.includes("score mate")) {
    if (pendingSelectedPlayerMove) return;
    let match = msg.match(/score mate (-?\d+)/);
    if (match) {
      let mateIn = parseInt(match[1]);
      let absoluteMate = game.turn() === "b" ? -mateIn : mateIn;
      updateEvalBar(absoluteMate > 0 ? 10 : -10);
      updateCoach(
        "Checkmate!",
        `Forced mate in ${Math.abs(mateIn)} moves detected!`,
        mateIn > 0 ? "good" : "bad",
      );
    }
  } else if (msg.includes("bestmove")) {
    let bestEngineMove = msg.split(" ")[1];

    if (pendingSelectedPlayerMove) {
      storedSelectedPlayerBestMove = bestEngineMove;
      prevEval = currentEval;
      highlightSuggestedMove(storedSelectedPlayerBestMove);
      pendingSelectedPlayerMove = false;
      waitingForEvalAfterSelectedMove = true;
      updateCoach("Thinking...", "Calculating evaluation...", "neutral");
      analyzePosition(game.fen());
      return;
    }

    if (waitingForEvalAfterSelectedMove) {
      generateAdvice(currentEval, prevEval, storedSelectedPlayerBestMove);
      storedSelectedPlayerBestMove = null;
      waitingForEvalAfterSelectedMove = false;
    } else {
      generateAdvice(currentEval, prevEval, bestEngineMove);
    }
    prevEval = currentEval;
  }
}

function generateAdvice(current, previous, bestEngineMove) {
  const moveIndex = currentMoveIndex - 1;
  const moveWasByWhite = moveIndex % 2 === 0;
  const isSelectedPlayer =
    analyzeForColor &&
    ((analyzeForColor === "white" && moveWasByWhite) ||
      (analyzeForColor === "black" && !moveWasByWhite));

  let isWhiteMove = game.turn() === "b";
  let playerColor = isWhiteMove ? "White" : "Black";
  let delta = isWhiteMove ? current - previous : previous - current;

  let title = "Solid Move";
  let text = `The position is stable. Evaluation is ${current.toFixed(1)}.`;
  let sentiment = "neutral";
  let classification = null;

  if (!isSelectedPlayer) {
    if (!analyzeForColor) {
      title = "Choose player";
      text = "Choose which player's moves to analyze (White or Black above), then click Next Move.";
    } else {
      title = "Opponent's move";
      text = `Evaluation is ${current.toFixed(1)}. Click Next to see ${analyzeForColor === "white" ? "White" : "Black"}'s next move.`;
    }
    clearSuggestedMoveHighlight();
    updateCoach(title, text, sentiment);
    return;
  }

  if (bestEngineMove) {
    highlightSuggestedMove(bestEngineMove);
  }

  if (currentMoveIndex === 1) {
    text = "Opening phase. Control the center and develop your pieces!";
  } else if (delta < -2.0) {
    title = "😱 Blunder!";
    text = `Ouch! ${playerColor} just lost a major advantage. Evaluation dropped by ${Math.abs(delta).toFixed(1)}. The engine preferred <b>${bestEngineMove}</b>.`;
    sentiment = "bad";
    classification = "blunder";
  } else if (delta < -0.8) {
    title = "⚠️ Mistake";
    text = `Not the best move. It gave away some positioning. The engine preferred <b>${bestEngineMove}</b>.`;
    sentiment = "bad";
    classification = "mistake";
  } else if (delta < -0.3) {
    title = "⚠ Inaccuracy";
    text = `Slightly imprecise. The engine preferred <b>${bestEngineMove}</b>. Evaluation is ${current.toFixed(1)}.`;
    sentiment = "neutral";
    classification = "inaccuracy";
  } else if (delta > 0.8) {
    title = "🔥 Great Move!";
    text = `Excellent find by ${playerColor}! You improved your position significantly.`;
    sentiment = "good";
    classification = "good";
  } else if (
    bestEngineMove &&
    moves[moveIndex].san.includes(bestEngineMove.substring(2, 4))
  ) {
    title = "⭐ Best Move";
    text = `You found the top engine move! Keep it up.`;
    sentiment = "good";
    classification = "best";
  }

  if (classification) {
    moveClassifications[moveIndex] = classification;
    addMoveClassificationIcon(moveIndex, classification);
  }

  updateCoach(title, text, sentiment);
}
