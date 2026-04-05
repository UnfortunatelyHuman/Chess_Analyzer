// eco.js - Lightweight ECO Opening Dictionary
// Matches the piece-placement part of a FEN to a known opening name.

const ecoDictionary = {
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR": "King's Pawn Game",
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR": "Queen's Pawn Game",
  "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR": "Sicilian Defense",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR": "Open Game",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R":
    "Ruy Lopez / Italian Game",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R": "Ruy Lopez",
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R": "Italian Game",
  "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R": "Petrov's Defense",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR": "Vienna Game",
  "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR": "French Defense",
  "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR": "Caro-Kann Defense",
  "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R": "Zukertort Opening",
  "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR": "English Opening",
  "rnbqkb1r/pppppp1p/5np1/8/2P5/8/PP1PPPPP/RNBQKBNR":
    "English Opening: King's Indian",
  "rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR":
    "Modern Defense",
  "rnbqkb1r/pppppp1p/5np1/8/3P4/8/PPP1PPPP/RNBQKBNR":
    "King's Indian Defense",
  "rnbqkb1r/pppp1ppp/4pn2/8/3P4/8/PPP1PPPP/RNBQKBNR":
    "Indian Game",
  "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR":
    "Queen's Gambit Declined",
  "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR":
    "Queen's Pawn Game: Symmetrical",
  "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR": "Queen's Gambit",
  "rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR":
    "Queen's Gambit Declined",
  "rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR":
    "Queen's Gambit Accepted",
  "rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR":
    "King's Indian Defense",
  "rnbqkb1r/p1pppppp/1p3n2/8/2PP4/8/PP2PPPP/RNBQKBNR":
    "Queen's Indian Defense",
  "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R":
    "Nimzo-Indian / Queen's Indian",
  "rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR":
    "Nimzo-Indian Defense",
  "rnbqkbnr/pppppp1p/6p1/8/8/5N2/PPPPPPPP/RNBQKB1R": "King's Indian Attack",
  "rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR":
    "English Opening: Reversed Sicilian",
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR": "Queen's Pawn Game",
  "r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR": "Nimzowitsch Defense",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R": "King's Knight Opening",
  "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR": "Scandinavian Defense",
  "rnbqkbnr/pppp1ppp/4p3/8/3P4/8/PPP1PPPP/RNBQKBNR": "French Defense",
};

/**
 * Look up the opening name for a given FEN string.
 * Returns the name, or null if the position is not in the dictionary.
 */
export function getOpeningName(fen) {
  if (!fen) return "Starting Position";
  if (
    fen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  )
    return "Starting Position";

  const piecePlacement = fen.split(" ")[0];
  return ecoDictionary[piecePlacement] || null;
}
