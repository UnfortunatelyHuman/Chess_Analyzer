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
  updateCapturedPieces,
  renderScorecard,
  playFeedback,
} from "./ui.js";

let board = null;
let game = new Chess();
let moves = [];
let clockTimes = [];
let moveClassifications = [];
let currentMoveIndex = 0;
let currentEngineDepth = 0;
let currentEngineScore = "0.00";
let currentEnginePV = "Waiting for engine...";
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
/** Variation (Free Play) state */
let originalMoves = [];
let originalClockTimes = [];
let originalClassifications = [];
let isVariation = false;
/** Touch swipe tracking */
let touchStartX = 0;
let touchEndX = 0;

$(document).ready(function () {
  initEngine(handleEngineMessage);

  board = Chessboard("board", {
    position: "start",
    draggable: true,
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
    moveSpeed: 500,
    appearSpeed: 500,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
  });

  $(window).resize(board.resize);
  $("#btnFirst").on("click", function () {
    jumpToStart();
  });
  $("#btnNext").on("click", nextMove);
  $("#btnPrev").on("click", prevMove);
  $("#btnLast").on("click", function () {
    if (moves.length > 0) jumpToMove(moves.length - 1);
  });
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

  // Exit variation: restore original game
  $("#btnExitVariation").on("click", function () {
    // 1. Exit variation mode
    isVariation = false;
    $("#variation-banner").hide();

    // 2. Restore the original tracking arrays
    moves = [...originalMoves];
    clockTimes = [...originalClockTimes];
    moveClassifications = [...originalClassifications];

    // 3. FORCE the UI to redraw the original move list!
    renderMoveList(moves);

    // 4. Re-apply all the saved classification icons (⭐, ✖, etc.)
    for (let i = 0; i < moveClassifications.length; i++) {
      if (moveClassifications[i]) {
        addMoveClassificationIcon(i, moveClassifications[i]);
      }
    }

    // 5. Safely reset the board to the start of the main line
    jumpToStart();
  });
});

// --- TOUCH SWIPE GESTURES ---

function handleSwipe() {
  const swipeThreshold = 50;
  const deltaX = touchEndX - touchStartX;
  if (deltaX > swipeThreshold) nextMove();
  else if (deltaX < -swipeThreshold) prevMove();
}

$(function () {
  $("#board").on("touchstart", function (e) {
    touchStartX = e.originalEvent.changedTouches[0].screenX;
  });
  $("#board").on("touchend", function (e) {
    touchEndX = e.originalEvent.changedTouches[0].screenX;
    handleSwipe();
  });
});

// --- DRAG & DROP (Free Play) ---

function onDragStart(source, piece, position, orientation) {
  if (game.game_over()) return false;
  if (
    (game.turn() === "w" && piece.search(/^b/) !== -1) ||
    (game.turn() === "b" && piece.search(/^w/) !== -1)
  ) {
    return false;
  }
}

function onDrop(source, target) {
  let moveObj = game.move({ from: source, to: target, promotion: "q" });
  if (moveObj === null) return "snapback";
  if (moveObj.captured) playFeedback('capture');
  else playFeedback('move');

  // First branch: save originals and show banner
  if (!isVariation) {
    isVariation = true;
    $("#variation-banner").css("display", "flex");
    originalClassifications = [...moveClassifications];
  }

  // Truncate future moves — user is branching
  moves = moves.slice(0, currentMoveIndex);
  clockTimes = clockTimes.slice(0, currentMoveIndex);
  moveClassifications = moveClassifications.slice(0, currentMoveIndex);

  // Add the new move
  moves.push(moveObj);
  currentMoveIndex++;

  // Clean up pending engine state
  clearSuggestedMoveHighlight();
  pendingSelectedPlayerMove = false;
  waitingForEvalAfterSelectedMove = false;
  storedSelectedPlayerBestMove = null;

  // Update the UI
  highlightLastMove(source, target);
  renderMoveList(moves);
  highlightActiveMove(currentMoveIndex - 1);
  syncMaterial();

  // Trigger engine
  updateCoach("Thinking...", "Analyzing custom variation...", "neutral");
  currentEnginePV = "Calculating...";
  updateAnalysisView(currentEngineScore, currentEngineDepth, currentEnginePV);
  analyzePosition(game.fen());
}

function onSnapEnd() {
  board.position(game.fen(), false);
}

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

    // Save originals for variation restore
    originalMoves = [...moves];
    originalClockTimes = [...clockTimes];
    originalClassifications = [];
    isVariation = false;
    $("#variation-banner").hide();

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
    generateScorecard();
    updateBoardPlayerLabels(whitePlayerName, blackPlayerName, null);
    showPlayerChoice(whitePlayerName, blackPlayerName, function (color) {
      analyzeForColor = color;
      if (analyzeForColor === "both") {
        board.orientation("white");
      } else {
        board.orientation(analyzeForColor);
      }
      updateBoardPlayerLabels(
        whitePlayerName,
        blackPlayerName,
        analyzeForColor,
      );
      syncClocks(-1);
      syncMaterial();
      updateCoach(
        "Ready",
        analyzeForColor === "both"
          ? "Analyzing both players' moves. Click Next Move to start."
          : analyzeForColor === "white"
            ? "Analyzing White's moves. Click Next Move to start."
            : "Analyzing Black's moves. Click Next Move to start.",
        "neutral",
      );
      //to trigger the engine immediately:
      currentEnginePV = "Calculating...";
      updateAnalysisView(
        currentEngineScore,
        currentEngineDepth,
        currentEnginePV,
      );
      analyzePosition(game.fen());
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
    analyzeForColor === "both" ||
    (analyzeForColor &&
      ((analyzeForColor === "white" && currentMoveIndex % 2 === 0) ||
        (analyzeForColor === "black" && currentMoveIndex % 2 === 1)));

  if (isSelectedPlayerMove) {
    const savedFen = game.fen();
    const moveObj = game.move(move.san);
    if (moveObj && moveObj.captured) playFeedback('capture');
    else playFeedback('move');
    board.position(game.fen(), true);
    currentMoveIndex++;
    highlightLastMove(move.from, move.to);
    highlightActiveMove(currentMoveIndex - 1);
    syncClocks(currentMoveIndex - 1);
    syncMaterial();
    pendingSelectedPlayerMove = true;
    updateCoach("Thinking...", "Finding the best move for you...", "neutral");
    currentEnginePV = "Calculating...";
    updateAnalysisView(currentEngineScore, currentEngineDepth, currentEnginePV);
    analyzePosition(savedFen);
    return;
  }

  const moveObj = game.move(move.san);
  if (moveObj && moveObj.captured) playFeedback('capture');
  else playFeedback('move');
  board.position(game.fen(), true);
  currentMoveIndex++;
  highlightLastMove(move.from, move.to);
  highlightActiveMove(currentMoveIndex - 1);
  syncClocks(currentMoveIndex - 1);
  syncMaterial();
  updateCoach("Thinking...", "Calculating the best moves...", "neutral");
  currentEnginePV = "Calculating...";
  updateAnalysisView(currentEngineScore, currentEngineDepth, currentEnginePV);
  analyzePosition(game.fen());
}

function prevMove() {
  clearSuggestedMoveHighlight();
  pendingSelectedPlayerMove = false;
  waitingForEvalAfterSelectedMove = false;
  storedSelectedPlayerBestMove = null;
  if (currentMoveIndex > 0) {
    game.undo();
    playFeedback('move');
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
    currentEnginePV = "Calculating...";
    updateAnalysisView(currentEngineScore, currentEngineDepth, currentEnginePV);
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
  if (lastMove && lastMove.captured) playFeedback('capture');
  else playFeedback('move');
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
  updateCoach(
    "Start",
    "Back to the beginning. Click Next Move to step through.",
    "neutral",
  );
  analyzePosition(game.fen());
}

/** Flip the board and swap the UI orientation. */
function flipBoard() {
  board.flip();
  $("#board-wrapper").toggleClass("flipped-layout");
}

/** Calculate material totals from the current board position. */
function calculateMaterial() {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const pieceOrder = ['q', 'r', 'b', 'n', 'p'];
  const startingPieces = { p: 8, n: 2, b: 2, r: 2, q: 1 };

  // Count current pieces on the board
  let whiteCounts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  let blackCounts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  let whiteTotal = 0;
  let blackTotal = 0;

  const boardArr = game.board();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = boardArr[row][col];
      if (sq && pieceValues[sq.type]) {
        if (sq.color === "w") {
          whiteCounts[sq.type]++;
          whiteTotal += pieceValues[sq.type];
        } else {
          blackCounts[sq.type]++;
          blackTotal += pieceValues[sq.type];
        }
      }
    }
  }

  // Figure out which pieces are missing (captured)
  let capturedByWhite = []; // Black pieces White has taken
  let capturedByBlack = []; // White pieces Black has taken

  for (const type of pieceOrder) {
    const missingBlack = startingPieces[type] - blackCounts[type];
    for (let i = 0; i < missingBlack; i++) capturedByWhite.push(type);
    const missingWhite = startingPieces[type] - whiteCounts[type];
    for (let i = 0; i < missingWhite; i++) capturedByBlack.push(type);
  }

  const diff = whiteTotal - blackTotal;
  return {
    whiteAdvantage: diff > 0 ? diff : 0,
    blackAdvantage: diff < 0 ? -diff : 0,
    capturedByWhite,
    capturedByBlack,
  };
}

/** Sync the material advantage badges and captured pieces. */
function syncMaterial() {
  const mat = calculateMaterial();
  updateMaterial(mat.whiteAdvantage, mat.blackAdvantage, analyzeForColor);
  updateCapturedPieces(mat.capturedByWhite, mat.capturedByBlack, analyzeForColor);
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

/** Convert raw UCI PV string (e.g. "e2e4 e7e5") into numbered SAN (e.g. "1. e4 e5"). */
function formatEngineLine(pvString, startFen) {
  if (!pvString) return "";
  let tempGame = new Chess(startFen);
  const rawMoves = pvString.trim().split(/\s+/);
  let formattedLine = [];

  for (let i = 0; i < rawMoves.length; i++) {
    const raw = rawMoves[i];
    if (raw.length < 4) continue;
    const from = raw.substring(0, 2);
    const to = raw.substring(2, 4);
    const promotion = raw.length >= 5 ? raw[4] : undefined;

    // Much safer move number calculation
    const moveNum = Math.floor(tempGame.history().length / 2) + 1;
    const isWhite = tempGame.turn() === "w";

    // Safely build the move object so chess.js doesn't crash
    let moveParams = { from: from, to: to };
    if (promotion) moveParams.promotion = promotion;

    const moveObj = tempGame.move(moveParams);
    if (!moveObj) {
      // If the parser ever fails, just push the raw text and stop so it doesn't break
      formattedLine.push(raw);
      break;
    }

    if (isWhite) {
      formattedLine.push(moveNum + ". " + moveObj.san);
    } else if (i === 0) {
      formattedLine.push(moveNum + "... " + moveObj.san);
    } else {
      formattedLine.push(moveObj.san);
    }
  }

  return formattedLine.join(" ");
}

function handleEngineMessage(msg) {
  // Catch any line that contains engine info
  if (msg.startsWith("info ")) {
    let uiNeedsUpdate = false;

    // 1. Check for Depth updates
    const depthMatch = msg.match(/depth (\d+)/);
    if (depthMatch) {
      currentEngineDepth = parseInt(depthMatch[1]);
      uiNeedsUpdate = true;
    }

    // 2. Check for Score updates
    const cpMatch = msg.match(/score cp (-?\d+)/);
    const mateMatch = msg.match(/score mate (-?\d+)/);

    if (cpMatch) {
      let cp = parseInt(cpMatch[1]);
      let evalInPawns = cp / 100;
      if (game.turn() === "b") evalInPawns = -evalInPawns; // Absolute perspective

      currentEngineScore =
        (evalInPawns > 0 ? "+" : "") + evalInPawns.toFixed(2);

      // Update the visual bar
      if (!pendingSelectedPlayerMove) {
        currentEval = evalInPawns;
        updateEvalBar(currentEval);
      }
      uiNeedsUpdate = true;
    } else if (mateMatch) {
      let mateIn = parseInt(mateMatch[1]);
      let absoluteMate = game.turn() === "b" ? -mateIn : mateIn;

      currentEngineScore = (absoluteMate > 0 ? "+M" : "-M") + Math.abs(mateIn);

      // Update the visual bar for checkmate
      if (!pendingSelectedPlayerMove) {
        updateEvalBar(absoluteMate > 0 ? 10 : -10);
      }
      uiNeedsUpdate = true;
    }

    // 3. Check for PV (Best Line) updates
    const pvMatch = msg.match(/ pv (.*)/);
    if (pvMatch) {
      const rawPv = pvMatch[1].trim();
      const readableLine = formatEngineLine(rawPv, game.fen());
      currentEnginePV = readableLine || rawPv;
      uiNeedsUpdate = true;
    }

    // 4. Update the Analysis Tab if anything changed
    if (uiNeedsUpdate) {
      updateAnalysisView(
        currentEngineScore,
        currentEngineDepth,
        currentEnginePV,
      );
    }
  }

  // Handle the final "bestmove" trigger
  if (msg.includes("bestmove")) {
    let bestEngineMove = msg.split(" ")[1];

    if (pendingSelectedPlayerMove) {
      storedSelectedPlayerBestMove = bestEngineMove;
      prevEval = currentEval;
      highlightSuggestedMove(storedSelectedPlayerBestMove);
      pendingSelectedPlayerMove = false;
      waitingForEvalAfterSelectedMove = true;
      updateCoach("Thinking...", "Calculating evaluation...", "neutral");

      currentEnginePV = "Calculating evaluation...";
      updateAnalysisView(
        currentEngineScore,
        currentEngineDepth,
        currentEnginePV,
      );
      analyzePosition(game.fen());
      return;
    }

    if (waitingForEvalAfterSelectedMove) {
      if (currentMoveIndex > 0) {
        generateAdvice(currentEval, prevEval, storedSelectedPlayerBestMove);
      }
      storedSelectedPlayerBestMove = null;
      waitingForEvalAfterSelectedMove = false;
    } else {
      if (currentMoveIndex > 0) {
        generateAdvice(currentEval, prevEval, bestEngineMove);
      }
    }
    prevEval = currentEval;
    generateScorecard();
  }
}

function generateAdvice(current, previous, bestEngineMove) {
  const moveIndex = currentMoveIndex - 1;
  const moveWasByWhite = moveIndex % 2 === 0;
  const isSelectedPlayer =
    analyzeForColor === "both" ||
    (analyzeForColor &&
      ((analyzeForColor === "white" && moveWasByWhite) ||
        (analyzeForColor === "black" && !moveWasByWhite)));

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
      text =
        "Choose which player's moves to analyze (White or Black above), then click Next Move.";
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
    if (classification === 'blunder') playFeedback('blunder');
  }

  updateCoach(title, text, sentiment);
}

/** Tally move classifications and render the scorecard. */
function generateScorecard() {
  const accScores = { best: 100, good: 85, inaccuracy: 50, mistake: 20, blunder: 0 };
  let whiteCounts = {};
  let blackCounts = {};
  let whiteScoreSum = 0;
  let whiteScoreCount = 0;
  let blackScoreSum = 0;
  let blackScoreCount = 0;

  for (let i = 0; i < moveClassifications.length; i++) {
    const cls = moveClassifications[i];
    if (!cls) continue;

    if (i % 2 === 0) {
      // White's move
      whiteCounts[cls] = (whiteCounts[cls] || 0) + 1;
      if (accScores[cls] !== undefined) {
        whiteScoreSum += accScores[cls];
        whiteScoreCount++;
      }
    } else {
      // Black's move
      blackCounts[cls] = (blackCounts[cls] || 0) + 1;
      if (accScores[cls] !== undefined) {
        blackScoreSum += accScores[cls];
        blackScoreCount++;
      }
    }
  }

  const whiteAcc = whiteScoreCount > 0 ? Math.round(whiteScoreSum / whiteScoreCount) : "--";
  const blackAcc = blackScoreCount > 0 ? Math.round(blackScoreSum / blackScoreCount) : "--";

  renderScorecard(whiteCounts, blackCounts, whiteAcc, blackAcc);
}
