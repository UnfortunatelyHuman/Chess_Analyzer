// main.js - The Controller

import { initEngine, analyzePosition } from "./engine.js";
import {
  updateCoach,
  updateEvalBar,
  toggleSetupMenu,
  hideSetupMenu,
} from "./ui.js";

let board = null;
let game = new Chess();
let moves = [];
let currentMoveIndex = 0;
let currentEval = 0.0;
let prevEval = 0.0;

$(document).ready(function () {
  initEngine(handleEngineMessage);

  board = Chessboard("board", {
    position: "start",
    draggable: false,
    pieceTheme:
      "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
  });

  $(window).resize(board.resize);
  $("#btnNext").on("click", nextMove);
  $("#btnPrev").on("click", prevMove);
  $("#btnLoad").on("click", loadGame);
  $("#toggle-setup").on("click", toggleSetupMenu);
});

// --- CORE GAME CONTROLS ---

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

    updateCoach(
      "Game Loaded",
      "I'm ready! Click 'Next Move' to start the analysis.",
      "neutral",
    );
    updateEvalBar(0);
    hideSetupMenu();
  } else {
    updateCoach(
      "Error",
      "That PGN looks invalid. Please check the text and try again.",
      "bad",
    );
  }
}

function nextMove() {
  if (currentMoveIndex < moves.length) {
    let move = moves[currentMoveIndex];

    game.move(move.san);
    board.position(game.fen());
    currentMoveIndex++;

    updateCoach("Thinking...", "Calculating the best moves...", "neutral");
    analyzePosition(game.fen());
  } else {
    updateCoach("End of Game", "That's all the moves! How did you do?", "good");
  }
}

function prevMove() {
  if (currentMoveIndex > 0) {
    game.undo();
    board.position(game.fen());
    currentMoveIndex--;
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
    generateAdvice(currentEval, prevEval, bestEngineMove);
    prevEval = currentEval;
  }
}

function generateAdvice(current, previous, bestEngineMove) {
  let isWhiteMove = game.turn() === "b";
  let playerColor = isWhiteMove ? "White" : "Black";
  let delta = isWhiteMove ? current - previous : previous - current;

  let title = "Solid Move";
  let text = `The position is stable. Evaluation is ${current.toFixed(1)}.`;
  let sentiment = "neutral";

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
    moves[currentMoveIndex - 1].san.includes(bestEngineMove.substring(2, 4))
  ) {
    title = "⭐ Best Move";
    text = `You found the top engine move! Keep it up.`;
    sentiment = "good";
  }

  updateCoach(title, text, sentiment);
}
