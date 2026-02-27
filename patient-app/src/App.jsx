/**
 * Patient PWA – root router. Public: /login (email magic link), /activate (invite link).
 * Protected: Layout shell with Home and Reminders; redirect to /login if not authenticated.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Activate from "./pages/Activate";
import Home from "./pages/Home";
import Reminders from "./pages/Reminders";
import Profile from "./pages/Profile";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/activate" element={<Activate />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
