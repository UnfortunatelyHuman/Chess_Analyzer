import { initEngine, analyzePosition } from "./engine.js";
import { updateEvalBar, showAnalysis, toggleSetup } from "./ui.js";

var board = null;
var game = new Chess();
var moves = [];
var currentMoveIndex = 0;

// 1. Initialize Board
function onDragStart() {
  return false;
}
board = Chessboard("board", {
  position: "start",
  draggable: false,
  pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
});

// 2. Initialize Engine
initEngine(handleEngineMessage);

function handleEngineMessage(msg) {
  // Parse Stockfish output (e.g. "score cp 50")
  if (msg.includes("score cp")) {
    let match = msg.match(/score cp (-?\d+)/);
    if (match) {
      let score = parseInt(match[1]) / 100;
      updateEvalBar(score, false);
    }
  } else if (msg.includes("score mate")) {
    let match = msg.match(/score mate (-?\d+)/);
    if (match) {
      updateEvalBar(100, true);
    }
  }

  if (msg.includes("bestmove")) {
    showAnalysis("Engine finished calculating.");
  }
}

// 3. Event Listeners
$("#btnLoad").on("click", () => {
  let pgn = $("#pgnInput").val();
  if (game.load_pgn(pgn)) {
    moves = game.history({ verbose: true });
    game.reset();
    board.position("start");
    currentMoveIndex = 0;
    showAnalysis("Game Loaded.");
    $("#pgn-area").hide();
  } else {
    alert("Invalid PGN");
  }
});

$("#btnNext").on("click", () => {
  if (currentMoveIndex < moves.length) {
    game.move(moves[currentMoveIndex].san);
    board.position(game.fen());
    currentMoveIndex++;
    showAnalysis("Thinking...");
    analyzePosition(game.fen());
  }
});

$("#btnPrev").on("click", () => {
  if (currentMoveIndex > 0) {
    game.undo();
    board.position(game.fen());
    currentMoveIndex--;
  }
});

$("#toggle-pgn").on("click", toggleSetup);

// Handle window resize
$(window).resize(board.resize);
