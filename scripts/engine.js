// engine.js - Handles Web Worker and Stockfish Communication

let stockfish = null;
let isReady = false;

export function initEngine(onMessageCallback) {
  const stockfishUrl =
    "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js";

  fetch(stockfishUrl)
    .then((response) => response.text())
    .then((script) => {
      const blob = new Blob([script], { type: "application/javascript" });
      stockfish = new Worker(URL.createObjectURL(blob));

      stockfish.onmessage = (event) => {
        onMessageCallback(event.data);
      };

      stockfish.postMessage("uci");
      isReady = true;
      console.log("Stockfish Engine Initialized");
    })
    .catch((err) => console.error("Failed to load engine:", err));
}

export function analyzePosition(fen, depth = 18) {
  if (!isReady) return;
  stockfish.postMessage("setoption name MultiPV value 3");
  stockfish.postMessage("position fen " + fen);
  stockfish.postMessage("go depth " + depth);
}

// Limit Stockfish's power during Sparring Mode (level 0-20)
export function setEngineSkillLevel(level) {
  if (!isReady) return;
  stockfish.postMessage("setoption name Skill Level value " + level);
}
