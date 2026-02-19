// This is an ES6 Module
let stockfish = null;
let isReady = false;

export function initEngine(onMessageCallback) {
  // Load Stockfish from online source
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
      console.log("Engine Loaded");
    });
}

export function analyzePosition(fen) {
  if (!isReady) return;
  stockfish.postMessage("position fen " + fen);
  stockfish.postMessage("go depth 15"); // Depth 15 is decent speed/quality balance
}
