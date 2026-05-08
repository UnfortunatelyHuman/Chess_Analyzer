// main.js - The Controller

import { initEngine, analyzePosition, setEngineSkillLevel } from "./engine.js";
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
  drawArrow,
  clearArrows,
  getSquareFromCoords,
} from "./ui.js";
import { getOpeningName } from "./eco.js";

let board = null;
let game = new Chess();
let savedGames = JSON.parse(localStorage.getItem("chessAnalyzerLibrary")) || [];
let userSettings = JSON.parse(
  localStorage.getItem("chessAnalyzerSettings"),
) || {
  engineDepth: 14,
  showEvalBar: true,
  showArrows: true,
};
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
/** Sparring / Training mode */
let isSparringMode = false;
/** Quiz / Mistake Review mode */
let isQuizMode = false;
let mistakeIndices = [];
let currentBestMoveUCI = null;
/** Lesson mode */
let activeLesson = null;
/** Auto-Analyze state */
let isAutoAnalyzing = false;
let autoAnalyzeIndex = 0;
let autoAnalyzeEvals = [];
let autoAnalyzeBestMoves = [];
/** Chess Clock state */
let whiteTime = 600;
let blackTime = 600;
let timeIncrement = 0;
let timerInterval = null;
let activeColor = "w";
/** Premove state */
let pendingPremove = null;
/** Blindfold state */
let isBlindfold = false;

$(document).ready(function () {
  initEngine(handleEngineMessage);

  board = Chessboard("board", {
    position: "start",
    draggable: true,
    pieceTheme: "https://lichess1.org/assets/piece/cburnett/{piece}.svg",
    moveSpeed: 500,
    appearSpeed: 500,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
  });

  $(window).resize(board.resize);
  $(".nav-item[title='Review']").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    $(".tab-btn[data-target='tab-review']").click(); // Opens the right-hand tab
  });
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

  // Key Moments: jump to move from scorecard review
  window.addEventListener("jumpToMove", function (e) {
    const idx = e.detail;
    if (!isNaN(idx)) jumpToMove(idx);
  });

  // Exit variation: restore original game
  $("#btnExitVariation").on("click", function () {
    // 1. Exit variation mode and quiz mode
    isVariation = false;
    isQuizMode = false;
    $("#variation-banner").hide();
    $("#variation-banner").find("span").text("🔀 Exploring Variation");
    $("#btnExitVariation").text("Return to Game");

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

  // --- Training Hub Controls ---
  $("#scenario-select").on("change", function () {
    const fen = $(this).val();
    if (fen === "start") {
      game.reset();
    } else {
      game.load(fen);
    }
    moves = [];
    clockTimes = [];
    moveClassifications = [];
    currentMoveIndex = 0;
    currentEval = 0.0;
    prevEval = 0.0;
    isVariation = false;
    $("#variation-banner").hide();
    board.position(game.fen());
    renderMoveList(moves);
    highlightActiveMove(-1);
    clearSuggestedMoveHighlight();
    clearArrows("engine");
    clearLastMoveHighlight();
    syncMaterial();
    updateEvalBar(0);
    updateCoach(
      "Position Loaded",
      "Make a move or enable Sparring Mode to play vs Stockfish.",
      "neutral",
    );
    currentEnginePV = "Calculating...";
    updateAnalysisView(currentEngineScore, currentEngineDepth, currentEnginePV);
    analyzePosition(game.fen(), userSettings.engineDepth);
  });

  $("#btnSparringMode").on("click", function () {
    isSparringMode = !isSparringMode;
    if (isSparringMode) {
      const level = parseInt($("#sparring-level").val());
      setEngineSkillLevel(level);
      $("#sparring-level").show();
      $("#btnResignReview").show();
      $(this).text("Stop Training").css("background", "#b33430");

      // Initialize clocks from time control selector
      const timeSettings = $("#time-control-select").val().split(",");
      whiteTime = parseInt(timeSettings[0]);
      blackTime = parseInt(timeSettings[0]);
      timeIncrement = parseInt(timeSettings[1]);
      activeColor = "w";
      updateTimerUI();

      updateCoach(
        "Sparring Mode",
        `Play a move! Stockfish (Level ${level}) will reply automatically.`,
        "neutral",
      );
    } else {
      setEngineSkillLevel(20);
      $("#sparring-level").hide();
      $("#btnResignReview").hide();
      stopClocks();
      $(this).text("Train vs AI").css("background", "var(--accent-green)");
      updateCoach("Sparring Mode", "Sparring mode disabled.", "neutral");
    }
  });

  $("#sparring-level").on("change", function () {
    if (isSparringMode) {
      const level = parseInt($(this).val());
      setEngineSkillLevel(level);
      updateCoach(
        "Difficulty Changed",
        `Stockfish is now playing at level ${level}.`,
        "neutral",
      );
    }
  });

  // --- Full Game Auto-Analyzer ---
  $("#btnRunFullAnalysis").on("click", function () {
    if (moves.length === 0) return;
    isAutoAnalyzing = true;
    autoAnalyzeIndex = 0;
    autoAnalyzeEvals = [0.2]; // Standard starting position evaluation
    autoAnalyzeBestMoves = ["e2e4"]; // Standard best opening move
    moveClassifications = new Array(moves.length).fill(null);

    $("#auto-analyze-prompt").hide();
    $("#scorecard-container")
      .show()
      .html(
        '<div style="text-align: center; padding: 20px; color: var(--accent-green); font-weight: bold;">Analyzing Game (Depth ' +
          userSettings.engineDepth +
          '): <span id="analyze-progress">0</span>%</div>',
      );

    // Reset board and start loop WITHOUT analyzing the start position again
    game.reset();
    analyzeNextMoveInLoop();
  });

  // --- Mistake Review / Quiz Mode ---
  $("#btnReviewMistakes").on("click", function () {
    if (mistakeIndices.length === 0) return;
    isQuizMode = true;
    $("#variation-banner")
      .css("display", "flex")
      .find("span")
      .text("🧠 Mistake Review Mode");
    $("#btnExitVariation").text("Exit Review");
    loadNextMistake();
  });

  // --- Save to Library ---
  $("#btnSaveGame").on("click", function () {
    const pgnData = $("#pgnInput").val();
    if (!pgnData) {
      updateCoach("Nothing to save", "Load a PGN game first.", "bad");
      return;
    }

    const newGame = {
      id: Date.now(),
      white: whitePlayerName || "White",
      black: blackPlayerName || "Black",
      date: new Date().toLocaleDateString(),
      pgn: pgnData,
    };

    savedGames.push(newGame);
    localStorage.setItem("chessAnalyzerLibrary", JSON.stringify(savedGames));

    playFeedback("move");
    $(this)
      .text("✅ Saved to Library")
      .css("background", "var(--accent-green)")
      .css("color", "white");
    setTimeout(() => {
      $(this).text("💾 Save to Library").css("background", "").css("color", "");
    }, 2000);
  });

  // --- Settings Modal & State ---
  function applySettings() {
    $("#depth-display").text(userSettings.engineDepth);
    $("#setting-depth").val(userSettings.engineDepth);
    $("#setting-eval-bar").prop("checked", userSettings.showEvalBar);
    $("#setting-arrows").prop("checked", userSettings.showArrows);

    if (userSettings.showEvalBar) {
      $("#eval-bar-container").show();
    } else {
      $("#eval-bar-container").hide();
    }

    if (!userSettings.showArrows) {
      clearArrows("engine");
    }

    localStorage.setItem("chessAnalyzerSettings", JSON.stringify(userSettings));
  }

  applySettings();

  $(".nav-item[title='Settings']").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    applySettings();
    $("#settings-modal").fadeIn(150).css("display", "flex");
  });

  $("#btnCloseSettings").on("click", function () {
    $("#settings-modal").fadeOut(150);
    $(".nav-item[title='Settings']").removeClass("active");
    $(".nav-item[title='Analyze']").addClass("active");

    userSettings.engineDepth = parseInt($("#setting-depth").val());
    userSettings.showEvalBar = $("#setting-eval-bar").is(":checked");
    userSettings.showArrows = $("#setting-arrows").is(":checked");

    applySettings();

    if (moves.length > 0) {
      updateCoach(
        "Settings Saved",
        `Engine depth set to ${userSettings.engineDepth}.`,
        "neutral",
      );
      analyzePosition(game.fen(), userSettings.engineDepth);
    }
  });

  $("#setting-depth").on("input", function () {
    $("#depth-display").text($(this).val());
  });

  // --- Annotated PGN Export ---
  $("#btnExportPGN").on("click", function () {
    if (moves.length === 0) {
      updateCoach("Nothing to export", "Load and analyze a game first.", "bad");
      return;
    }

    let pgnString = "";

    // 1. Add standard headers
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, ".");
    pgnString += `[Event "Chess Analyzer Game"]\n`;
    pgnString += `[Date "${dateStr}"]\n`;
    pgnString += `[White "${whitePlayerName || "White"}"]\n`;
    pgnString += `[Black "${blackPlayerName || "Black"}"]\n`;
    pgnString += `[Result "*"]\n\n`;

    // 2. Build the annotated move text
    const symbolMap = {
      blunder: "??",
      mistake: "?",
      inaccuracy: "?!",
      good: "!",
      best: "",
    };

    let currentMoveNum = 1;

    for (let i = 0; i < moves.length; i++) {
      // Print move number for White
      if (i % 2 === 0) {
        pgnString += `${currentMoveNum}. `;
      }

      // 3. Append the move
      let san = moves[i].san;

      // 4. Append the classification symbol (if any)
      const classification = moveClassifications[i];
      if (classification && symbolMap[classification]) {
        san += symbolMap[classification];
      }

      pgnString += san + " ";

      // 5. Add text comments for blunders/mistakes
      if (classification === "blunder" || classification === "mistake") {
        pgnString += `{ ${classification === "blunder" ? "Blunder." : "Mistake."} } `;
      }

      // Increment move number after Black's move
      if (i % 2 !== 0) {
        currentMoveNum++;
      }
    }

    // 6. Copy to clipboard
    navigator.clipboard
      .writeText(pgnString.trim())
      .then(() => {
        const btn = $("#btnExportPGN");
        const originalText = btn.text();
        btn
          .text("✅ Copied to Clipboard!")
          .css("background", "var(--accent-green)")
          .css("color", "white");
        setTimeout(() => {
          btn.text(originalText).css("background", "").css("color", "");
        }, 2000);
      })
      .catch((err) => {
        console.error("Could not copy text: ", err);
        updateCoach("Export Failed", "Could not access clipboard.", "bad");
      });
  });

  // --- Resign & Game Over Modal ---
  $("#btnResignReview").on("click", function () {
    $("#game-over-title").text("You Resigned");
    $("#game-over-modal").fadeIn(150).css("display", "flex");
  });

  $("#btnModalReview").on("click", function () {
    $("#game-over-modal").fadeOut(150);

    // 1. Turn off sparring safely
    if (isSparringMode) {
      isSparringMode = false;
      setEngineSkillLevel(20);
      $("#sparring-level, #btnResignReview").hide();
      $("#btnSparringMode")
        .text("Train vs AI")
        .css("background", "var(--accent-green)");
    }

    // 2. Teleport to Analysis UI
    $(".nav-item[title='Analyze']").click();

    // 3. Open the Review Tab
    $(".tab-btn[data-target='tab-review']").click();

    // 4. Trigger the Auto-Analyzer!
    $("#btnRunFullAnalysis").click();
  });

  $("#btnModalClose").on("click", function () {
    $("#game-over-modal").fadeOut(150);
  });

  // --- Sidebar Navigation (SPA Router) ---

  $(".nav-item[title='Analyze']").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    $(".training-header, #learning-hub").hide();
    $("#toggle-setup, #move-list-container").show();
    if (isSparringMode) $("#btnSparringMode").click();
    activeLesson = null;
    stopClocks();
    jumpToStart();
    $(".tab-btn[data-target='tab-coach']").click();
    updateCoach(
      "Analysis Mode 🎯",
      "Make moves on the board or paste a PGN below to begin.",
      "neutral",
    );
  });

  $(".nav-item[title='Train']").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    $(".training-header").css("display", "flex");
    $("#learning-hub, #toggle-setup").hide();
    $("#move-list-container").show();
    hideSetupMenu();
    activeLesson = null;
    jumpToStart();
    $("#scenario-select").val("start");
    $(".tab-btn[data-target='tab-coach']").click();
    updateCoach(
      "Training Hub ⚔️",
      "Select a scenario above, or click 'Train vs AI' to spar.",
      "neutral",
    );
  });

  $(".nav-item[title='Learn']").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    $(".training-header, #toggle-setup, #move-list-container").hide();
    $("#learning-hub").show();
    hideSetupMenu();
    if (isSparringMode) $("#btnSparringMode").click();
    activeLesson = null;

    game.reset();
    board.position("start");
    renderLessons();
    $(".tab-btn[data-target='tab-coach']").click();
    updateCoach(
      "Welcome to the Academy 🎓",
      "Select a lesson below to master chess fundamentals and tactics.",
      "neutral",
    );
  });

  // --- Lesson Database & Framework ---
  const lessons = [
    {
      id: 1,
      title: "1. The Back Rank Mate",
      desc: "Trap the King behind his own pawns.",
      fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
      correctMove: "e1e8",
      successMsg:
        "Perfect! The pawns trap the king, and your rook delivers checkmate.",
    },
    {
      id: 2,
      title: "2. The Knight Fork",
      desc: "Attack two valuable pieces at the exact same time.",
      fen: "4q1k1/8/8/8/4N3/8/8/4K3 w - - 0 1",
      correctMove: "e4f6",
      successMsg:
        "Excellent! The Knight checks the King and attacks the Queen simultaneously. You win the Queen!",
    },
    {
      id: 3,
      title: "3. The Absolute Pin",
      desc: "Use your Rook to trap the Black Queen. She cannot move because the King is behind her!",
      fen: "4k3/4q3/8/8/8/8/8/7R w - - 0 1",
      correctMove: "h1e1",
      successMsg:
        "Brilliant! The Queen is pinned to the King. She is paralyzed and you will win her next turn.",
    },
    {
      id: 4,
      title: "4. The Skewer",
      desc: "An X-Ray attack! Check the King, and when he moves out of the way, take the Queen behind him.",
      fen: "4q3/8/8/4k3/8/8/8/7R w - - 0 1",
      correctMove: "h1e1",
      successMsg:
        "Ouch! The King is forced to step aside, leaving the Queen completely undefended.",
    },
    {
      id: 5,
      title: "5. Smothered Mate",
      desc: "The enemy King is completely trapped by his own pieces. Deliver the final blow with your Knight.",
      fen: "6rk/6pp/8/6N1/8/8/8/7K w - - 0 1",
      correctMove: "g5f7",
      successMsg:
        "Checkmate! A beautiful smothered mate. The King has nowhere to run.",
    },
  ];

  function renderLessons() {
    const list = $("#lesson-list");
    list.empty();
    lessons.forEach((l) => {
      list.append(`
        <div class="lesson-card" data-id="${l.id}" style="background: var(--bg-panel-alt); padding: 12px; border-radius: var(--radius-sm); cursor: pointer; border: 1px solid var(--border-color); transition: 0.2s;">
            <div style="font-weight: 700; color: var(--accent-gold); font-size: 13px; margin-bottom: 4px;">${l.title}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${l.desc}</div>
        </div>
      `);
    });
  }

  $("#learning-hub").on("click", ".lesson-card", function () {
    const id = $(this).data("id");
    activeLesson = lessons.find((l) => l.id === id);

    game.load(activeLesson.fen);
    board.position(game.fen(), false);
    clearArrows("engine");
    clearArrows("user");
    clearSuggestedMoveHighlight();

    updateCoach(
      "Lesson Active: " + activeLesson.title,
      "Find the winning move! Drag the correct piece.",
      "neutral",
    );
  });

  $("#learning-hub")
    .on("mouseenter", ".lesson-card", function () {
      $(this).css("background", "var(--bg-surface)");
    })
    .on("mouseleave", ".lesson-card", function () {
      $(this).css("background", "var(--bg-panel-alt)");
    });

  // --- Library Modal ---
  $(".nav-item[title='Library']").on("click", function () {
    $(".nav-item").removeClass("active");
    $(this).addClass("active");
    renderLibrary();
    $("#library-modal").fadeIn(150).css("display", "flex");
  });

  $("#btnCloseLibrary").on("click", function () {
    $("#library-modal").fadeOut(150);
    $(".nav-item[title='Library']").removeClass("active");
    $(".nav-item[title='Analyze']").addClass("active");
  });

  $("#library-list").on("click", ".saved-game-card", function (e) {
    if ($(e.target).hasClass("delete-game-btn")) return;

    const id = $(this).data("id");
    const gameToLoad = savedGames.find((g) => g.id === id);
    if (gameToLoad) {
      $("#pgnInput").val(gameToLoad.pgn);
      $("#library-modal").fadeOut(150);
      $(".nav-item[title='Library']").removeClass("active");
      $(".nav-item[title='Analyze']").addClass("active");
      $(".tab-btn[data-target='tab-coach']").click();
      loadGame();
    }
  });

  $("#library-list").on("click", ".delete-game-btn", function (e) {
    e.stopPropagation();
    const id = $(this).data("id");
    savedGames = savedGames.filter((g) => g.id !== id);
    localStorage.setItem("chessAnalyzerLibrary", JSON.stringify(savedGames));
    renderLibrary();
  });

  // --- The Chess.com Way: Math-Based Arrows & Strict Context Nuke ---

  // 1. Ultimate Global Context Menu Blocker
  // Nuke the right-click menu entirely across the whole application
  document.addEventListener(
    "contextmenu",
    function (e) {
      e.preventDefault();
      return false;
    },
    { capture: true, passive: false },
  );
  window.oncontextmenu = function () {
    return false;
  };

  let rightClickStartSquare = null;
  let tempArrow = null;

  // 2. Exact bounding box center calculation
  function getSquareCenter(square) {
    const el = document.querySelector(`#board .square-${square}`);
    const boardStack = document.getElementById("board-stack");
    if (!el || !boardStack) return null;

    const elRect = el.getBoundingClientRect();
    const stackRect = boardStack.getBoundingClientRect();

    return {
      x: elRect.left - stackRect.left + elRect.width / 2,
      y: elRect.top - stackRect.top + elRect.height / 2,
    };
  }

  // 3. Mousedown (Start drawing)
  document.addEventListener(
    "mousedown",
    function (e) {
      const boardStack = document.getElementById("board-stack");
      if (!boardStack || !boardStack.contains(e.target)) return;

      const isRightClick =
        e.button === 2 || e.which === 3 || (e.button === 0 && e.ctrlKey);

      if (isRightClick) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        rightClickStartSquare = getSquareFromCoords(e.clientX, e.clientY);

        if (rightClickStartSquare) {
          const center = getSquareCenter(rightClickStartSquare);
          if (center) {
            tempArrow = document.createElementNS(
              "http://www.w3.org/2000/svg",
              "line",
            );
            tempArrow.setAttribute("x1", center.x);
            tempArrow.setAttribute("y1", center.y);
            tempArrow.setAttribute("x2", center.x);
            tempArrow.setAttribute("y2", center.y);
            tempArrow.setAttribute("class", "arrow-line arrow-user");
            tempArrow.setAttribute("opacity", "0.6");
            document.getElementById("arrow-overlay").appendChild(tempArrow);
          }
        }
      } else if (e.button === 0 || e.which === 1) {
        clearArrows("user");
        clearLegalHints();
        clearPremove();
      }
    },
    { capture: true },
  );

  // 4. Mousemove (Math-based tracking)
  document.addEventListener(
    "mousemove",
    function (e) {
      if (rightClickStartSquare && tempArrow) {
        const boardStack = document.getElementById("board-stack");
        if (boardStack) {
          const stackRect = boardStack.getBoundingClientRect();
          const mouseX = e.clientX - stackRect.left;
          const mouseY = e.clientY - stackRect.top;

          tempArrow.setAttribute("x2", mouseX);
          tempArrow.setAttribute("y2", mouseY);
        }
      }
    },
    { capture: true },
  );

  // 5. Mouseup (Finalize)
  document.addEventListener(
    "mouseup",
    function (e) {
      if (rightClickStartSquare) {
        const isRightClick =
          e.button === 2 || e.which === 3 || (e.button === 0 && e.ctrlKey);

        if (isRightClick) {
          const endSquare = getSquareFromCoords(e.clientX, e.clientY);

          if (tempArrow) {
            tempArrow.remove();
            tempArrow = null;
          }

          if (endSquare && endSquare !== rightClickStartSquare) {
            drawArrow(rightClickStartSquare, endSquare, "user");
          }
        }
        rightClickStartSquare = null;
      }
    },
    { capture: true },
  );

  $(window).resize(function () {
    clearArrows();
  });

  // --- Theme Toggle Logic ---
  const currentTheme = localStorage.getItem("chessAnalyzerTheme") || "midnight";
  if (currentTheme === "ivory") {
    document.body.setAttribute("data-theme", "light");
  }

  $("#btnThemeToggle").on("click", function () {
    if (document.body.getAttribute("data-theme") === "light") {
      document.body.removeAttribute("data-theme");
      localStorage.setItem("chessAnalyzerTheme", "midnight");
    } else {
      document.body.setAttribute("data-theme", "light");
      localStorage.setItem("chessAnalyzerTheme", "ivory");
    }
  });

  // --- Blindfold Mode ---
  $("#btnBlindfold").on("click", function () {
    isBlindfold = !isBlindfold;
    if (isBlindfold) {
      $("#board").addClass("blindfold-active");
      $(this).find(".slash").show();
      $(this).addClass("active");
    } else {
      $("#board").removeClass("blindfold-active");
      $(this).find(".slash").hide();
      $(this).removeClass("active");
    }
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
  clearLegalHints();
  if (game.game_over()) return false;

  // Always allow picking up your own pieces (for premoves in sparring)
  const isOwnPiece =
    (piece.search(/^w/) !== -1 && board.orientation() === "white") ||
    (piece.search(/^b/) !== -1 && board.orientation() === "black");

  // Block picking up opponent's pieces
  if (
    (game.turn() === "w" && piece.search(/^b/) !== -1) ||
    (game.turn() === "b" && piece.search(/^w/) !== -1)
  ) {
    return false;
  }

  // If it's not our turn but we're sparring, allow drag for premove (no hints)
  if (
    isSparringMode &&
    isOwnPiece &&
    game.turn() !== board.orientation().charAt(0)
  ) {
    return; // Allow drag but skip legal hints
  }

  // Show legal move hints
  const legalMoves = game.moves({ square: source, verbose: true });
  if (legalMoves.length === 0) return;

  legalMoves.forEach((move) => {
    const squareEl = $("#board .square-" + move.to);
    if (game.get(move.to)) {
      squareEl.addClass("legal-hint-capture");
    } else {
      squareEl.addClass("legal-hint-dot");
    }
  });
}

/** Remove all legal move hint indicators from the board. */
function clearLegalHints() {
  $("#board .square-55d63").removeClass("legal-hint-dot legal-hint-capture");
}

/** Clear any queued premove and remove highlights. */
function clearPremove() {
  pendingPremove = null;
  $(".premove-highlight").removeClass("premove-highlight");
}

function onDrop(source, target) {
  clearLegalHints();

  // Premove: if it's the AI's turn during sparring, queue the move
  if (isSparringMode && game.turn() !== board.orientation().charAt(0)) {
    clearPremove();
    pendingPremove = { from: source, to: target };
    $("#board .square-" + source).addClass("premove-highlight");
    $("#board .square-" + target).addClass("premove-highlight");
    return "snapback";
  }

  clearPremove();

  // Quiz Mode intercept — check the guess without modifying the game
  if (isQuizMode) {
    const uciMove = source + target;
    if (
      uciMove === currentBestMoveUCI ||
      uciMove + "q" === currentBestMoveUCI
    ) {
      playFeedback("move");
      updateCoach("Brilliant! ⭐", "You found the best move!", "good");
      setTimeout(loadNextMistake, 2000);
    } else {
      playFeedback("blunder");
      updateCoach(
        "Not quite ❌",
        "That wasn't the best move. Keep looking!",
        "bad",
      );
    }
    return "snapback";
  }

  // Lesson Mode intercept
  if (activeLesson) {
    const uciMove = source + target;
    if (
      uciMove === activeLesson.correctMove ||
      uciMove + "q" === activeLesson.correctMove
    ) {
      playFeedback("move");
      updateCoach("Great Job! ⭐", activeLesson.successMsg, "good");
      game.move({ from: source, to: target, promotion: "q" });
      setTimeout(() => board.position(game.fen(), false), 250);
      activeLesson = null;
      return "snapback";
    } else {
      playFeedback("blunder");
      updateCoach(
        "Not quite ❌",
        "Try again! Look closely at the tactic.",
        "bad",
      );
      return "snapback";
    }
  }

  let moveObj = game.move({ from: source, to: target, promotion: "q" });
  if (moveObj === null) return "snapback";
  if (moveObj.captured) playFeedback("capture");
  else playFeedback("move");

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
  clearArrows("engine");
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
  analyzePosition(game.fen(), userSettings.engineDepth);

  // Clock: add increment for the player who just moved, switch, start on first move
  if (isSparringMode) {
    if (activeColor === "w") whiteTime += timeIncrement;
    else blackTime += timeIncrement;
    activeColor = "b";
    if (game.history().length === 1) startClocks();
    updateTimerUI();
  }

  checkGameOver();
}

function onSnapEnd() {
  clearLegalHints();
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
    clearArrows("engine");
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
      analyzePosition(game.fen(), userSettings.engineDepth);
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
  clearArrows("engine");
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
    if (moveObj && moveObj.captured) playFeedback("capture");
    else playFeedback("move");
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
  if (moveObj && moveObj.captured) playFeedback("capture");
  else playFeedback("move");
  board.position(game.fen(), true);
  currentMoveIndex++;
  highlightLastMove(move.from, move.to);
  highlightActiveMove(currentMoveIndex - 1);
  syncClocks(currentMoveIndex - 1);
  syncMaterial();
  updateCoach("Thinking...", "Calculating the best moves...", "neutral");
  currentEnginePV = "Calculating...";
  updateAnalysisView(currentEngineScore, currentEngineDepth, currentEnginePV);
  analyzePosition(game.fen(), userSettings.engineDepth);
}

function prevMove() {
  clearSuggestedMoveHighlight();
  clearArrows("engine");
  pendingSelectedPlayerMove = false;
  waitingForEvalAfterSelectedMove = false;
  storedSelectedPlayerBestMove = null;
  if (currentMoveIndex > 0) {
    game.undo();
    playFeedback("move");
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
    analyzePosition(game.fen(), userSettings.engineDepth);
  }
}

function jumpToMove(targetIndex) {
  // Clear any pending engine state
  clearSuggestedMoveHighlight();
  clearArrows("engine");
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
  if (lastMove && lastMove.captured) playFeedback("capture");
  else playFeedback("move");
  updateCoach("Thinking...", "Analyzing this position...", "neutral");
  analyzePosition(game.fen(), userSettings.engineDepth);
}

/** Jump back to the starting position. */
function jumpToStart() {
  clearSuggestedMoveHighlight();
  clearArrows("engine");
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
  analyzePosition(game.fen(), userSettings.engineDepth);
}

/** Flip the board and swap the UI orientation. */
function flipBoard() {
  board.flip();
  $("#board-wrapper").toggleClass("flipped-layout");
}

/** Calculate material totals from the current board position. */
function calculateMaterial() {
  const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const pieceOrder = ["q", "r", "b", "n", "p"];
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
  updateCapturedPieces(
    mat.capturedByWhite,
    mat.capturedByBlack,
    analyzeForColor,
  );
  syncOpeningName();
}

/** Update the opening name display based on the current position. */
let lastKnownOpening = "Starting Position";
function syncOpeningName() {
  const name = getOpeningName(game.fen());
  if (name) {
    lastKnownOpening = name;
  }
  $("#opening-name").text(lastKnownOpening);
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

    // Clear stale Multi-PV lines when engine restarts from depth 1
    const earlyDepthMatch = msg.match(/depth (\d+)/);
    if (earlyDepthMatch && parseInt(earlyDepthMatch[1]) <= 1) {
      $("#multi-pv-container").empty();
    }

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

    // 3b. Multi-PV rendering
    if (msg.includes("multipv") && msg.includes("score")) {
      let pvNumMatch = msg.match(/multipv (\d+)/);
      let pvNum = pvNumMatch ? parseInt(pvNumMatch[1]) : 1;

      let evalText = "";
      if (msg.includes("score cp")) {
        let cpM = msg.match(/score cp (-?\d+)/);
        if (cpM) {
          let val = parseInt(cpM[1]) / 100;
          if (game.turn() === "b") val = -val;
          evalText = (val > 0 ? "+" : "") + val.toFixed(2);
        }
      } else if (msg.includes("score mate")) {
        let mateM = msg.match(/score mate (-?\d+)/);
        if (mateM) {
          let m = parseInt(mateM[1]);
          if (game.turn() === "b") m = -m;
          evalText = (m > 0 ? "+" : "") + "M" + Math.abs(m);
        }
      }

      let pvStringMatch = msg.match(/ pv (.*)/);
      let pvString = pvStringMatch ? pvStringMatch[1].split(" ").slice(0, 5).join(" ") : "";

      if ($("#multi-pv-container").length) {
        if ($(`#pv-line-${pvNum}`).length === 0) {
          $("#multi-pv-container").append(
            `<div id="pv-line-${pvNum}" class="pv-line"><span class="pv-rank">${pvNum}.</span><span class="pv-eval"></span><span class="pv-moves"></span></div>`
          );
        }
        $(`#pv-line-${pvNum} .pv-eval`).text(evalText);
        $(`#pv-line-${pvNum} .pv-moves`).text(pvString);
      }
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
    currentBestMoveUCI = bestEngineMove;

    // Auto-Analyze intercept: capture eval and advance the loop
    if (isAutoAnalyzing) {
      autoAnalyzeEvals.push(currentEval);
      autoAnalyzeBestMoves.push(bestEngineMove);
      let progress = Math.round((autoAnalyzeIndex / moves.length) * 100);
      $("#analyze-progress").text(progress);
      autoAnalyzeIndex++;
      analyzeNextMoveInLoop();
      return;
    }

    if (pendingSelectedPlayerMove) {
      storedSelectedPlayerBestMove = bestEngineMove;
      prevEval = currentEval;
      highlightSuggestedMove(storedSelectedPlayerBestMove);
      clearArrows("engine");
      if (userSettings.showArrows) {
        drawArrow(
          storedSelectedPlayerBestMove.substring(0, 2),
          storedSelectedPlayerBestMove.substring(2, 4),
          "engine",
        );
      }
      pendingSelectedPlayerMove = false;
      waitingForEvalAfterSelectedMove = true;
      updateCoach("Thinking...", "Calculating evaluation...", "neutral");

      currentEnginePV = "Calculating evaluation...";
      updateAnalysisView(
        currentEngineScore,
        currentEngineDepth,
        currentEnginePV,
      );
      analyzePosition(game.fen(), userSettings.engineDepth);
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

    // --- Sparring Mode: AI auto-play ---
    if (
      isSparringMode &&
      !game.game_over() &&
      game.turn() !== board.orientation().charAt(0)
    ) {
      setTimeout(() => {
        const from = bestEngineMove.substring(0, 2);
        const to = bestEngineMove.substring(2, 4);
        const prom = bestEngineMove.length > 4 ? bestEngineMove[4] : "q";
        const aiMove = game.move({ from: from, to: to, promotion: prom });
        if (aiMove) {
          moves = moves.slice(0, currentMoveIndex);
          moves.push(aiMove);
          currentMoveIndex++;
          board.position(game.fen());
          highlightLastMove(from, to);
          renderMoveList(moves);
          highlightActiveMove(currentMoveIndex - 1);
          syncMaterial();
          playFeedback(aiMove.captured ? "capture" : "move");
          updateCoach(
            "Your Turn",
            "Stockfish played. Make your move!",
            "neutral",
          );
          currentEnginePV = "Calculating...";
          updateAnalysisView(
            currentEngineScore,
            currentEngineDepth,
            currentEnginePV,
          );
          analyzePosition(game.fen(), userSettings.engineDepth);

          // Clock: add increment for AI, switch back to player
          if (isSparringMode) {
            blackTime += timeIncrement;
            activeColor = "w";
            updateTimerUI();
          }

          checkGameOver();

          // Execute queued premove
          if (pendingPremove) {
            const moveAttempt = game.move({
              from: pendingPremove.from,
              to: pendingPremove.to,
              promotion: "q",
            });

            if (moveAttempt) {
              moves = moves.slice(0, currentMoveIndex);
              moves.push(moveAttempt);
              currentMoveIndex++;
              board.position(game.fen());
              highlightLastMove(pendingPremove.from, pendingPremove.to);
              renderMoveList(moves);
              highlightActiveMove(currentMoveIndex - 1);
              syncMaterial();
              playFeedback(moveAttempt.captured ? "capture" : "move");

              // Clock: add increment for player, switch to AI
              if (isSparringMode) {
                if (activeColor === "w") whiteTime += timeIncrement;
                else blackTime += timeIncrement;
                activeColor = activeColor === "w" ? "b" : "w";
                updateTimerUI();
              }

              analyzePosition(game.fen(), userSettings.engineDepth);
              checkGameOver();
            }

            clearPremove();
          }
        }
      }, 500);
    }
  }
}

/** Check if the game has ended and show the game-over modal. */
function checkGameOver() {
  if (game.game_over()) {
    let reason = "Game Over";
    if (game.in_checkmate()) reason = "Checkmate!";
    else if (game.in_stalemate()) reason = "Stalemate";
    else if (game.in_threefold_repetition()) reason = "Draw by Repetition";
    else if (game.insufficient_material())
      reason = "Draw by Insufficient Material";

    $("#game-over-title").text(reason);
    $("#game-over-modal").fadeIn(150).css("display", "flex");
  }
}

/** Format seconds into m:ss or m:ss.t for bullet time. */
function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (seconds < 20 && seconds > 0) {
    const tenths = Math.floor((seconds % 1) * 10);
    return `${m}:${s < 10 ? "0" : ""}${s}.${tenths}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** Update the timer display and apply visual state classes. */
function updateTimerUI() {
  $("#timer-white").text(formatTime(whiteTime));
  $("#timer-black").text(formatTime(blackTime));

  $("#timer-white").toggleClass(
    "timer-active",
    activeColor === "w" && timerInterval !== null,
  );
  $("#timer-black").toggleClass(
    "timer-active",
    activeColor === "b" && timerInterval !== null,
  );

  $("#timer-white").toggleClass("timer-low", whiteTime <= 30);
  $("#timer-black").toggleClass("timer-low", blackTime <= 30);
}

/** Stop the chess clock. */
function stopClocks() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  updateTimerUI();
}

/** Start the chess clock with 100ms tick for smooth bullet rendering. */
function startClocks() {
  stopClocks();
  timerInterval = setInterval(() => {
    if (activeColor === "w") {
      whiteTime -= 0.1;
      if (whiteTime <= 0) handleTimeout("White");
    } else {
      blackTime -= 0.1;
      if (blackTime <= 0) handleTimeout("Black");
    }
    updateTimerUI();
  }, 100);
}

/** Handle a player running out of time. */
function handleTimeout(color) {
  stopClocks();
  $("#game-over-title").text(
    `Timeout! ${color === "White" ? "Black" : "White"} wins.`,
  );
  $("#game-over-modal").fadeIn(150).css("display", "flex");
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
    clearArrows("engine");
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
    if (classification === "blunder") playFeedback("blunder");
  }

  updateCoach(title, text, sentiment);
}

/** Tally move classifications and render the scorecard. */
function generateScorecard() {
  const accScores = {
    best: 100,
    good: 85,
    inaccuracy: 50,
    mistake: 20,
    blunder: 0,
  };
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

  const whiteAcc =
    whiteScoreCount > 0 ? Math.round(whiteScoreSum / whiteScoreCount) : "--";
  const blackAcc =
    blackScoreCount > 0 ? Math.round(blackScoreSum / blackScoreCount) : "--";

  renderScorecard(whiteCounts, blackCounts, whiteAcc, blackAcc);

  // Append "Key Moments" with best move suggestions for sub-optimal moves
  let momentsHtml = "";
  for (let i = 0; i < moveClassifications.length; i++) {
    const cls = moveClassifications[i];
    if (cls === "blunder" || cls === "mistake" || cls === "inaccuracy") {
      const moveNum = Math.floor(i / 2) + 1;
      const side = i % 2 === 0 ? "White" : "Black";
      const san = moves[i] ? moves[i].san : "?";
      const uci = autoAnalyzeBestMoves[i];
      let suggestionText = "";
      if (uci && uci.length >= 4) {
        suggestionText = uci.substring(0, 2) + " \u2192 " + uci.substring(2, 4);
      }

      const iconMap = {
        blunder: '<span class="move-icon icon-blunder">\u2716</span>',
        mistake: '<span class="move-icon icon-mistake">\u2047</span>',
        inaccuracy: '<span class="move-icon icon-inaccuracy">\u2048</span>',
      };

      momentsHtml += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-panel-alt); border-radius: 4px; margin-bottom: 6px; cursor: pointer;" onclick="window.dispatchEvent(new CustomEvent('jumpToMove', {detail: ${i}}))">
          <div>
            ${iconMap[cls]} <span style="color: #fff; font-weight: 600;">${moveNum}. ${san}</span>
            <span style="color: var(--text-muted); font-size: 11px; margin-left: 4px;">(${side})</span>
          </div>
          ${suggestionText ? `<div style="font-size: 11px; color: var(--accent-green); font-weight: bold;">\ud83d\udca1 Try: ${suggestionText}</div>` : ""}
        </div>
      `;
    }
  }

  if (momentsHtml) {
    $("#scorecard-container").append(`
      <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--border-color);">
        <div style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 700;">Key Moments</div>
        ${momentsHtml}
      </div>
    `);
  }

  // Populate mistake indices for Quiz Mode
  mistakeIndices = [];
  for (let i = 0; i < moveClassifications.length; i++) {
    const cls = moveClassifications[i];
    if (cls === "blunder" || cls === "mistake") {
      const isWhiteMove = i % 2 === 0;
      if (
        analyzeForColor === "both" ||
        (analyzeForColor === "white" && isWhiteMove) ||
        (analyzeForColor === "black" && !isWhiteMove)
      ) {
        mistakeIndices.push(i);
      }
    }
  }

  if (mistakeIndices.length > 0) {
    $("#btnReviewMistakes")
      .show()
      .text(`Learn From Mistakes (${mistakeIndices.length})`);
  } else {
    $("#btnReviewMistakes").hide();
  }
}

/** Load the next mistake position as an interactive quiz. */
function loadNextMistake() {
  if (mistakeIndices.length === 0) {
    isQuizMode = false;
    $("#variation-banner").hide();
    $("#variation-banner").find("span").text("🔀 Exploring Variation");
    $("#btnExitVariation").text("Return to Game");
    updateCoach(
      "Review Complete! 🎉",
      "You have reviewed all your mistakes. Great work!",
      "good",
    );
    return;
  }

  // Switch to Coach tab so they can see the instructions
  $(".tab-btn[data-target='tab-coach']").click();

  const blunderIndex = mistakeIndices.shift();
  // Jump to the position exactly BEFORE the blunder occurred
  jumpToMove(blunderIndex - 1);

  updateCoach(
    "Find the Best Move 🎯",
    "You made a mistake here. Can you find the engine's top choice? Drag that piece!",
    "bad",
  );
}

/** Render the library modal contents from savedGames. */
function renderLibrary() {
  const list = $("#library-list");
  list.empty();
  if (savedGames.length === 0) {
    list.append(
      "<p style='color: var(--text-muted); text-align: center; font-size: 13px;'>No saved games yet. Analyze a game and click Save!</p>",
    );
    return;
  }

  const sorted = [...savedGames].sort((a, b) => b.id - a.id);

  sorted.forEach((g) => {
    const card = $(`
      <div class="saved-game-card" data-id="${g.id}">
        <div class="saved-game-info">
          <span class="saved-game-title">⚪ ${g.white} vs ⚫ ${g.black}</span>
          <span class="saved-game-date">${g.date}</span>
        </div>
        <button class="delete-game-btn" data-id="${g.id}">Delete</button>
      </div>
    `);
    list.append(card);
  });
}

/** Safely convert engine eval strings (+1.5, M3, -M2) into usable math floats. */
function parseEvalToNumber(evalStr) {
  if (evalStr === undefined || evalStr === null) return 0;
  let str = evalStr.toString();
  if (str.includes("M")) {
    return str.includes("-") ? -99.0 : 99.0;
  }
  return parseFloat(str) || 0;
}

/** Auto-analyze loop: make move, evaluate, collect, repeat. */
function analyzeNextMoveInLoop() {
  // 1. Check if we have analyzed all moves
  if (autoAnalyzeIndex >= moves.length) {
    isAutoAnalyzing = false;

    // 2. Loop finished — classify all moves using parsed numbers
    for (let i = 0; i < moves.length; i++) {
      let prev = parseEvalToNumber(autoAnalyzeEvals[i]);
      let curr = parseEvalToNumber(autoAnalyzeEvals[i + 1]);

      let isWhiteMove = i % 2 === 0;
      let delta = isWhiteMove ? curr - prev : prev - curr;

      if (delta <= -2.0) moveClassifications[i] = "blunder";
      else if (delta <= -0.8) moveClassifications[i] = "mistake";
      else if (delta <= -0.3) moveClassifications[i] = "inaccuracy";
      else if (delta >= 0.5) moveClassifications[i] = "good";
      else moveClassifications[i] = "best";

      addMoveClassificationIcon(i, moveClassifications[i]);
    }

    generateScorecard();
    jumpToMove(moves.length - 1);
    updateCoach(
      "Analysis Complete! 📊",
      "Check the Review tab to see your mistakes.",
      "good",
    );
    return;
  }

  // 3. Make the move FIRST, then ask the engine to analyze the resulting board
  game.move(moves[autoAnalyzeIndex].san);
  analyzePosition(game.fen(), userSettings.engineDepth);
}
