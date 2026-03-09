/**
 * Memory Match – dementia-friendly card matching game.
 * Adapted from DementiaGames/card_memory_game_fruits with React, large touch targets,
 * clear feedback, and optional backend session save.
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/apiClient";
import "./MemoryGame.css";

/* Timestamp forces fresh image fetch on each page load (bypasses cache) */
const IMG_V = Date.now();

const CARD_DATA = [
  { image: `/games/memory/apple.png?v=${IMG_V}`, name: "apple" },
  { image: `/games/memory/banana.png?v=${IMG_V}`, name: "banana" },
  { image: `/games/memory/cherries.png?v=${IMG_V}`, name: "cherries" },
  { image: `/games/memory/grapes.png?v=${IMG_V}`, name: "grapes" },
  { image: `/games/memory/kiwi.png?v=${IMG_V}`, name: "kiwi" },
  { image: `/games/memory/lemon.png?v=${IMG_V}`, name: "lemon" },
  { image: `/games/memory/mango.png?v=${IMG_V}`, name: "mango" },
  { image: `/games/memory/strawberry.png?v=${IMG_V}`, name: "strawberry" },
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function MemoryGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState(new Set());
  const [matched, setMatched] = useState(new Set());
  const [first, setFirst] = useState(null);
  const [second, setSecond] = useState(null);
  const [lockBoard, setLockBoard] = useState(false);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timerId, setTimerId] = useState(null);

  const initCards = useCallback(() => {
    const doubled = [...CARD_DATA, ...CARD_DATA];
    setCards(shuffle(doubled));
    setFlipped(new Set());
    setMatched(new Set());
    setFirst(null);
    setSecond(null);
    setLockBoard(false);
    setMoves(0);
    setSeconds(0);
  }, []);

  const startGame = () => {
    initCards();
    setGameStarted(true);
    setGamePaused(false);
    setGameWon(false);
    setTimerId(
      setInterval(() => setSeconds((s) => s + 1), 1000)
    );
  };

  const pauseGame = () => {
    if (!gameStarted || gameWon) return;
    setGamePaused(true);
    if (timerId) clearInterval(timerId);
    setTimerId(null);
  };

  const resumeGame = () => {
    if (!gameStarted || !gamePaused || gameWon) return;
    setGamePaused(false);
    setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
  };

  const playAgain = () => {
    if (timerId) clearInterval(timerId);
    initCards();
    setGameStarted(true);
    setGamePaused(false);
    setGameWon(false);
    setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
  };

  const saveSession = async (finalMoves, finalSeconds) => {
    const totalPairs = CARD_DATA.length;
    const accuracy = totalPairs / Math.max(finalMoves, 1);
    try {
      await apiRequest("/api/games", {
        method: "POST",
        body: JSON.stringify({
          gameType: "memory",
          score: finalMoves,
          duration: Math.round(finalSeconds),
          accuracy: Math.min(1, accuracy),
        }),
      });
    } catch (_) {
      // Silent fail – session saved locally; backend optional
    }
  };

  const handleCardClick = (idx) => {
    if (!gameStarted || gamePaused || gameWon || lockBoard) return;
    if (flipped.has(idx) || matched.has(cards[idx]?.name)) return;
    if (first !== null && first === idx) return;

    const newFlipped = new Set(flipped).add(idx);

    if (first === null) {
      setFirst(idx);
      setFlipped(newFlipped);
      return;
    }

    setSecond(idx);
    setFlipped(newFlipped);
    setMoves((m) => m + 1);
    setLockBoard(true);

    const name1 = cards[first]?.name;
    const name2 = cards[idx]?.name;

    if (name1 === name2) {
      const newMatched = new Set([...matched, name1]);
      setMatched(newMatched);
      setFirst(null);
      setSecond(null);
      setLockBoard(false);
      if (newMatched.size === CARD_DATA.length) {
        if (timerId) clearInterval(timerId);
        setTimerId(null);
        setGameWon(true);
        saveSession(moves + 1, seconds);
      }
    } else {
      setTimeout(() => {
        setFlipped((f) => {
          const next = new Set(f);
          next.delete(first);
          next.delete(idx);
          return next;
        });
        setFirst(null);
        setSecond(null);
        setLockBoard(false);
      }, 1200);
    }
  };

  useEffect(() => {
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [timerId]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const showStart = !gameStarted;
  const showVictory = gameStarted && gameWon;
  const showPause = gameStarted && gamePaused && !gameWon;

  return (
    <div className="pa-memory-game">
      <div className="pa-memory-header">
        <Link to="/games" className="pa-memory-back" aria-label="Back to games">
          ← Back
        </Link>
        <h2 className="pa-memory-title">Memory Match</h2>
      </div>

      {showStart && (
        <div className="pa-memory-overlay pa-memory-start" role="dialog" aria-label="Start game">
          <div className="pa-memory-overlay-content pa-memory-start-content">
            <h3>Memory Match</h3>
            <p>Tap cards to flip them. Find matching pairs of fruit.</p>
            <button
              type="button"
              className="pa-memory-btn pa-memory-btn-start"
              onClick={startGame}
              aria-label="Start game"
            >
              Start
            </button>
          </div>
        </div>
      )}

      {showPause && (
        <div className="pa-memory-overlay" role="dialog" aria-label="Game paused">
          <div className="pa-memory-overlay-content">
            <h3>Paused</h3>
            <button
              type="button"
              className="pa-memory-btn"
              onClick={resumeGame}
              aria-label="Resume game"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      {showVictory && (
        <div className="pa-memory-overlay" role="dialog" aria-label="You won">
          <div className="pa-memory-overlay-content">
            <h3>Well done!</h3>
            <p className="pa-memory-stats">
              Time: {formatTime(seconds)} · Moves: {moves}
            </p>
            <div className="pa-memory-victory-actions">
              <button
                type="button"
                className="pa-memory-btn pa-memory-btn-primary"
                onClick={playAgain}
                aria-label="Play again"
              >
                Play Again
              </button>
              <Link
                to="/games"
                className="pa-memory-btn pa-memory-btn-secondary"
              >
                Back to games
              </Link>
            </div>
          </div>
        </div>
      )}

      <div
        className={`pa-memory-play ${showStart || showVictory || showPause ? "is-blurred" : ""}`}
      >
        <div className="pa-memory-stats-bar">
          <span>Moves: {moves}</span>
          <span>Time: {formatTime(seconds)}</span>
          {gameStarted && !gameWon && (
            <button
              type="button"
              className="pa-memory-btn pa-memory-btn-sm"
              onClick={gamePaused ? resumeGame : pauseGame}
              aria-label={gamePaused ? "Resume" : "Pause"}
            >
              {gamePaused ? "Resume" : "Pause"}
            </button>
          )}
        </div>

        <div className="pa-memory-grid" role="grid" aria-label="Memory game cards">
          {cards.map((card, idx) => (
            <button
              key={idx}
              type="button"
              className={`pa-memory-card ${flipped.has(idx) || matched.has(card.name) ? "is-flipped" : ""}`}
              onClick={() => handleCardClick(idx)}
              disabled={lockBoard || gamePaused || gameWon}
              aria-label={
                flipped.has(idx) || matched.has(card.name)
                  ? `Card: ${card.name}`
                  : "Card face down"
              }
              aria-pressed={flipped.has(idx) || matched.has(card.name)}
            >
              <div className="pa-memory-card-inner">
                <div className="pa-memory-card-front">
                  <img
                    src={card.image}
                    alt={card.name}
                    decoding="async"
                    onError={(e) => {
                      e.target.style.visibility = "hidden";
                    }}
                  />
                </div>
                <div className="pa-memory-card-back" aria-hidden="true" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
