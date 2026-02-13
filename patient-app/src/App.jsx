import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import Home from "./pages/Home";
import Reminders from "./pages/Reminders";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="reminders" element={<Reminders />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
