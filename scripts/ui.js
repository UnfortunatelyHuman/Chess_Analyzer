// ui.js - Handles all DOM manipulation and CSS changes

export function updateCoach(title, text, sentiment) {
  $("#coach-title").html(title);
  $("#coach-text").html(text);

  let color = "#ffd700"; // Neutral (Yellow)
  if (sentiment === "bad") color = "#ff4444"; // Red
  if (sentiment === "good") color = "#4CAF50"; // Green

  $(".coach-bubble").css("border-left-color", color);
  $("#coach-title").css("color", color);
}

export function updateEvalBar(score) {
  // Clamp visual score between -5 and +5
  let visualScore = Math.max(-5, Math.min(5, score));
  // Calculate percentage (0% = Black +5, 50% = Equal, 100% = White +5)
  let percent = ((visualScore + 5) / 10) * 100;

  $("#eval-fill").css("height", percent + "%");

  // Format the text label
  let label = score > 0 ? "+" + score.toFixed(1) : score.toFixed(1);
  $("#eval-score").text(label);
}

export function toggleSetupMenu() {
  $("#setup-area").slideToggle();
}

export function hideSetupMenu() {
  $("#setup-area").hide();
}
