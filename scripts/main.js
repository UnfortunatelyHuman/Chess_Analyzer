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
} from "./ui.js";

let board = null;
let game = new Chess();
let moves = [];
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
  $("#btnNext").on("click", nextMove);
  $("#btnPrev").on("click", prevMove);
  $("#btnLoad").on("click", loadGame);
  $("#toggle-setup").on("click", toggleSetupMenu);
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
    updateBoardPlayerLabels(whitePlayerName, blackPlayerName, null);
    showPlayerChoice(whitePlayerName, blackPlayerName, function (color) {
      analyzeForColor = color;
      board.orientation(analyzeForColor);
      updateBoardPlayerLabels(whitePlayerName, blackPlayerName, analyzeForColor);
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
    pendingSelectedPlayerMove = true;
    updateCoach("Thinking...", "Finding the best move for you...", "neutral");
    analyzePosition(savedFen);
    return;
  }

  game.move(move.san);
  board.position(game.fen(), true);
  currentMoveIndex++;
  highlightLastMove(move.from, move.to);
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

// --- ENGINE TRANSLATION & COACHING ---

function handleEngineMessage(msg) {
  if (msg.includes("score cp")) {
    if (pendingSelectedPlayerMove) return;
    let match = msg.match(/score cp (-?\d+)/);
    if (match) {
      let cp = parseInt(match[1]);
      let evalInPawns = cp / 100;

      if (game.turn() === "b") {
        evalInPawns = -evalInPawns;
      }

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
  } else if (delta < -0.8) {
    title = "⚠️ Mistake";
    text = `Not the best move. It gave away some positioning. The engine preferred <b>${bestEngineMove}</b>.`;
    sentiment = "bad";
  } else if (delta > 0.8) {
    title = "🔥 Great Move!";
    text = `Excellent find by ${playerColor}! You improved your position significantly.`;
    sentiment = "good";
  } else if (
    bestEngineMove &&
    moves[moveIndex].san.includes(bestEngineMove.substring(2, 4))
  ) {
    title = "⭐ Best Move";
    text = `You found the top engine move! Keep it up.`;
    sentiment = "good";
  }

  updateCoach(title, text, sentiment);
}
