/**
 * Caregiver dashboard – root router. AuthProvider wraps the app; protected routes
 * use Layout (sidebar + outlet). Public: login, register, verify-email.
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Reminders from './pages/Reminders';
import Activity from './pages/Activity';
import Location from './pages/Location';
import Settings from './pages/Settings';
import Messages from './pages/Messages';
import VerifyEmail from './pages/VerifyEmail';

function App() {
    return (
        <AuthProvider>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-email" element={<VerifyEmail />} />

                {/* All routes below require logged-in caregiver */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }>
                    <Route index element={<Dashboard />} />
                    <Route path="patients" element={<Patients />} />
                    <Route path="reminders" element={<Reminders />} />
                    <Route path="activity" element={<Activity/>} />
                    <Route path="location" element={<Location />} />
                    <Route path="messages" element={<Messages />} />
                    <Route path="settings" element={<Settings />} />
                </Route>

                {/* Catch all - redirect to home */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AuthProvider>
    );
}
export default App;