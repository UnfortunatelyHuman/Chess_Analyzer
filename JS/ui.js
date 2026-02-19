export function updateEvalBar(score, isMate) {
  // Limit bar visually between -5 and +5
  let visualScore = Math.max(-5, Math.min(5, score));
  let percent = ((visualScore + 5) / 10) * 100;

  // Invert because in CSS height starts from bottom
  $("#eval-bar-fill").css("height", percent + "%");

  let text = isMate ? "MATE" : score > 0 ? "+" + score : score;
  $("#eval-score").text(text);
}

export function showAnalysis(text) {
  $("#analysis-text").text(text);
}

export function toggleSetup() {
  $("#pgn-area").toggle();
}
