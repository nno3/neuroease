/** Logged-in home – placeholder content and links to Reminders and Games. */
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="pa-page">
      <h2 className="pa-heading">Home</h2>
      <p className="pa-muted">Your reminders will appear here (or on the Reminders page).</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px" }}>
        <Link to="/reminders" className="pa-btn pa-btn--primary">
          View reminders
        </Link>
        <Link to="/games" className="pa-btn">
          Brain games
        </Link>
      </div>
    </div>
  );
}
