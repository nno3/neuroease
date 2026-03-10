/**
 * Games list – dementia-friendly cognitive games.
 * Large touch targets, clear labels; links to Memory Match and future games.
 */
import { Link } from "react-router-dom";
import "./Games.css";

const GAMES = [
  {
    id: "memory",
    path: "/games/memory",
    title: "Memory Match",
    description: "Match pairs of fruit cards. Tap cards to flip and find matches.",
    icon: "🍎",
  },
  {
    id: "math",
    path: "/games/math",
    title: "Math Practice",
    description: "Practice addition, subtraction, multiplication, and division.",
    icon: "🔢",
  },
];

export default function Games() {
  return (
    <div className="pa-games">
      <h2 className="pa-games-title">Brain Games</h2>
      <p className="pa-games-intro">
        Play simple games to keep your mind active.
      </p>
      <ul className="pa-games-list" role="list">
        {GAMES.map((game) => (
          <li key={game.id}>
            <Link
              to={game.path}
              className="pa-game-card"
              aria-label={`Play ${game.title}. ${game.description}`}
            >
              <span className="pa-game-icon" aria-hidden="true">
                {game.icon}
              </span>
              <div className="pa-game-text">
                <h3 className="pa-game-title">{game.title}</h3>
                <p className="pa-game-desc">{game.description}</p>
              </div>
              <span className="pa-game-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
