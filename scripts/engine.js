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

export function analyzePosition(fen) {
  if (!isReady) return;
  stockfish.postMessage("position fen " + fen);
  stockfish.postMessage("go depth 14"); // Depth 14 is fast but accurate enough for beginners
}
