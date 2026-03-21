/**
 * Math Practice – dementia-friendly arithmetic game.
 * Ported from DementiaGames/mathGame 2 with React, large touch targets, clear feedback.
 * Supports Add, Subtract, Multiply, Divide.
 *
 * Sound feedback (correct/wrong): Research shows that "feedback prompts for every
 * action performed are critical for successful perception and task completion"
 * in people with dementia. Multimodal cues (audio + visual) support accessibility.
 * Ref: Frontiers in Sports and Active Living (2024) – enhancing prompt perception
 * in dementia with mixed reality cue modalities.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../services/apiClient";
import { getGameSoundsEnabled } from "../utils/gameSounds";
import "./MathGame.css";

const OPERATIONS = [
  { id: "add", symbol: "+", label: "Add", name: "Addition" },
  { id: "subtract", symbol: "−", label: "Subtract", name: "Subtraction" },
  { id: "multiply", symbol: "×", label: "Multiply", name: "Multiplication" },
  { id: "divide", symbol: "÷", label: "Divide", name: "Division" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDummy(answer, other, minVal = 0) {
  let dummy;
  const range = Math.max(3, Math.abs(answer));
  do {
    dummy = answer + Math.floor(Math.random() * (range * 2 + 1)) - range;
  } while (dummy === answer || dummy === other || dummy < minVal);
  return dummy;
}

/**
 * Difficulty levels control the number range for each operation.
 * Rationale: Learning therapy (Nouchi et al., Front. Hum. Neurosci. 2016) uses
 * single-digit addition (e.g. 1+3) as lowest difficulty; we scaffold Easy → Normal → Hard.
 * See docs/CognitiveGames_Dementia.md §5 for full rationale and references.
 */
function generateEquation(op, difficulty = "normal") {
  const config = {
    easy: { add: 5, subtract: 6, multiply: 4, divide: 4 },
    normal: { add: 10, subtract: 10, multiply: 6, divide: 5 },
    hard: { add: 15, subtract: 15, multiply: 10, divide: 10 },
  };
  const c = config[difficulty] || config.normal;
  let num1, num2, answer;
  switch (op) {
    case "add":
      num1 = Math.floor(Math.random() * c.add) + 1;
      num2 = Math.floor(Math.random() * c.add) + 1;
      answer = num1 + num2;
      break;
    case "subtract":
      num1 = Math.floor(Math.random() * c.subtract) + 1;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
      break;
    case "multiply":
      num1 = Math.floor(Math.random() * c.multiply) + 1;
      num2 = Math.floor(Math.random() * c.multiply) + 1;
      answer = num1 * num2;
      break;
    case "divide":
      num2 = Math.floor(Math.random() * c.divide) + 1;
      const mult = Math.floor(Math.random() * c.divide) + 1;
      num1 = num2 * mult;
      answer = num1 / num2;
      break;
    default:
      num1 = 1; num2 = 1; answer = 2;
  }
  const d1 = generateDummy(answer, null, op === "multiply" || op === "divide" ? 1 : 0);
  const d2 = generateDummy(answer, d1, op === "multiply" || op === "divide" ? 1 : 0);
  const options = shuffle([answer, d1, d2]);
  return { num1, num2, answer, options };
}

export default function MathGame() {
  const navigate = useNavigate();
  const [operation, setOperation] = useState(null);
  const [difficulty, setDifficulty] = useState("normal"); // "easy" | "normal" | "hard"
  const [gameStarted, setGameStarted] = useState(false);
  const [equation, setEquation] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackHint, setFeedbackHint] = useState("");
  const [totalQuestionTime, setTotalQuestionTime] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [timerId, setTimerId] = useState(null);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [gamePaused, setGamePaused] = useState(false);
  const questionStartRef = useRef(Date.now());
  const lastAttemptSecondsRef = useRef(0);
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  const nextQuestion = useCallback((op, diff) => {
    setEquation(generateEquation(op, diff));
    setShowFeedback(false);
    setTotalQuestionTime(0);
    questionStartRef.current = Date.now();
  }, []);

  const startGame = (op) => {
    setOperation(op);
    setGameStarted(true);
    setGamePaused(false);
    setSeconds(0);
    setQuestionsCorrect(0);
    setTotalAttempts(0);
    setShowSessionSummary(false);
    nextQuestion(op, difficulty);
    setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
  };

  const pauseGame = () => {
    if (showSessionSummary) return;
    setGamePaused(true);
    if (timerId) clearInterval(timerId);
    setTimerId(null);
  };

  const resumeGame = () => {
    setGamePaused(false);
    setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
  };

  const saveSession = async (finalCorrect, finalSeconds, finalAttempts) => {
    const accuracy =
      finalAttempts > 0 ? Math.min(1, finalCorrect / finalAttempts) : null;
    try {
      await apiRequest("/api/games", {
        method: "POST",
        body: JSON.stringify({
          gameType: "math",
          score: finalCorrect,
          duration: Math.round(finalSeconds),
          accuracy: accuracy,
          maxScore: finalAttempts,
          difficulty,
        }),
      });
    } catch (_) {
      // Silent fail – offline or backend unavailable
    }
  };

  const endSession = () => {
    if (timerId) clearInterval(timerId);
    setTimerId(null);
    saveSession(questionsCorrect, seconds, totalAttempts);
    setShowSessionSummary(true);
  };

  const handleBack = () => {
    if (gameStarted && !showSessionSummary) {
      saveSession(questionsCorrect, seconds, totalAttempts);
    }
    navigate("/games");
  };

  const playAgain = () => {
    setShowSessionSummary(false);
    setSeconds(0);
    setQuestionsCorrect(0);
    setTotalAttempts(0);
    nextQuestion(operation, difficulty);
    setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
  };

  const playFeedbackSound = (correct) => {
    if (!getGameSoundsEnabled()) return;
    try {
      const audio = correct ? correctSoundRef.current : wrongSoundRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    } catch (_) {}
  };

  const handleAnswer = (selected) => {
    if (!equation || showFeedback || gamePaused) return;
    setTotalAttempts((t) => t + 1);
    if (timerId) clearInterval(timerId);
    setTimerId(null);
    const correct = selected === equation.answer;
    const elapsed = Math.max(1, Math.floor((Date.now() - questionStartRef.current) / 1000));
    playFeedbackSound(correct);
    setIsCorrect(correct);
    if (correct) {
      setFeedbackMessage("Well done! That was correct.");
      setFeedbackHint(`You solved it in ${totalQuestionTime + elapsed} seconds. Let's try another!`);
    } else {
      lastAttemptSecondsRef.current = elapsed;
      const op = operation;
      const { num1, num2 } = equation;
      let hint = "Try again!";
      if (op === "add") hint = `Hint: Count up from ${Math.min(num1, num2)} by adding ${Math.max(num1, num2)}.`;
      else if (op === "subtract") hint = `Hint: Start with ${num1} and count backwards ${num2} times.`;
      else if (op === "multiply") hint = `Hint: ${num1} times ${num2} is the same as adding ${num1} together ${num2} times.`;
      else if (op === "divide") hint = `Hint: How many ${num2}s are in ${num1}?`;
      setFeedbackMessage("Not quite. Try again!");
      setFeedbackHint(hint);
    }
    setShowFeedback(true);
  };

  const continueGame = () => {
    if (isCorrect) {
      setQuestionsCorrect((c) => c + 1);
      nextQuestion(operation, difficulty);
      setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
    } else {
      setTotalQuestionTime((t) => t + lastAttemptSecondsRef.current);
      questionStartRef.current = Date.now();
      setTimerId(setInterval(() => setSeconds((s) => s + 1), 1000));
    }
    setShowFeedback(false);
  };

  useEffect(() => () => timerId && clearInterval(timerId), [timerId]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const opInfo = OPERATIONS.find((o) => o.id === operation);

  if (!gameStarted) {
    return (
      <div className="pa-math-game">
        <div className="pa-math-header">
          <button type="button" className="pa-math-back" onClick={handleBack}>
            ← Back to games
          </button>
          <h2 className="pa-math-title">Math Practice</h2>
        </div>
        <div className="pa-math-start">
          <h3>Choose a game</h3>
          <p className="pa-math-start-desc">Pick an operation to practice.</p>
          <div className="pa-math-difficulty">
            <span className="pa-math-difficulty-label">Difficulty:</span>
            <div className="pa-math-diff-btns">
            <button
              type="button"
              className={`pa-math-diff-btn ${difficulty === "easy" ? "is-active" : ""}`}
              onClick={() => setDifficulty("easy")}
              aria-pressed={difficulty === "easy"}
            >
              Easy
            </button>
            <button
              type="button"
              className={`pa-math-diff-btn ${difficulty === "normal" ? "is-active" : ""}`}
              onClick={() => setDifficulty("normal")}
              aria-pressed={difficulty === "normal"}
            >
              Normal
            </button>
            <button
              type="button"
              className={`pa-math-diff-btn ${difficulty === "hard" ? "is-active" : ""}`}
              onClick={() => setDifficulty("hard")}
              aria-pressed={difficulty === "hard"}
            >
              Hard
            </button>
            </div>
          </div>
          <div className="pa-math-ops">
            {OPERATIONS.map((op) => (
              <button
                key={op.id}
                type="button"
                className="pa-math-op-btn"
                onClick={() => startGame(op.id)}
              >
                <span className="pa-math-op-symbol">{op.symbol}</span>
                <span className="pa-math-op-label">{op.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pa-math-game">
      <div className="pa-math-header">
        <button type="button" className="pa-math-back" onClick={handleBack}>
          ← Back to games
        </button>
        <h2 className="pa-math-title">Math Practice</h2>
      </div>
      <div className="pa-math-stats-bar">
        <span>Time: {formatTime(seconds)}</span>
        <div className="pa-math-stats-actions">
          <button
            type="button"
            className="pa-math-pause-btn"
            onClick={gamePaused ? resumeGame : pauseGame}
            aria-label={gamePaused ? "Resume" : "Pause"}
          >
            {gamePaused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            className="pa-math-end-btn"
            onClick={endSession}
            aria-label="End session and see summary"
          >
            End session
          </button>
        </div>
      </div>
      <audio
        ref={correctSoundRef}
        src="/games/math/correct.mp3"
        preload="auto"
        aria-hidden="true"
      />
      <audio
        ref={wrongSoundRef}
        src="/games/math/wrong.mp3"
        preload="auto"
        aria-hidden="true"
      />
      {equation && (
        <div className={`pa-math-play ${gamePaused || showSessionSummary ? "is-blurred" : ""}`}>
          <div className="pa-math-equation">
            <span className="pa-math-num">{equation.num1}</span>
            <span className="pa-math-op">{opInfo?.symbol}</span>
            <span className="pa-math-num">{equation.num2}</span>
            <span className="pa-math-eq">=</span>
            <span className="pa-math-q">?</span>
          </div>
          <div className="pa-math-options">
            {equation.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                className="pa-math-option"
                onClick={() => handleAnswer(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
      {showFeedback && (
        <div className="pa-math-overlay">
          <div className={`pa-math-feedback ${isCorrect ? "is-correct" : "is-incorrect"}`}>
            <div className="pa-math-feedback-icon">{isCorrect ? "✓" : "✗"}</div>
            <h3>{feedbackMessage}</h3>
            <p>{feedbackHint}</p>
            <button
              type="button"
              className="pa-math-continue"
              onClick={continueGame}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {gamePaused && (
        <div className="pa-math-overlay" role="dialog" aria-label="Game paused">
          <div className="pa-math-feedback pa-math-pause-modal">
            <h3>Paused</h3>
            <p>Take your time. Tap Resume when you&apos;re ready to continue.</p>
            <button
              type="button"
              className="pa-math-continue"
              onClick={resumeGame}
              aria-label="Resume"
            >
              Resume
            </button>
          </div>
        </div>
      )}
      {showSessionSummary && (
        <div className="pa-math-overlay">
          <div className="pa-math-feedback is-correct">
            <div className="pa-math-feedback-icon">✓</div>
            <h3>Well done!</h3>
            <p className="pa-math-summary-text">
              You completed {questionsCorrect} {questionsCorrect === 1 ? "question" : "questions"}.
              <br />
              Time: {formatTime(seconds)}
            </p>
            <div className="pa-math-summary-actions">
              <button
                type="button"
                className="pa-math-continue pa-math-play-again"
                onClick={playAgain}
              >
                Play again
              </button>
              <button
                type="button"
                className="pa-math-continue pa-math-back-btn"
                onClick={handleBack}
              >
                Back to games
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
