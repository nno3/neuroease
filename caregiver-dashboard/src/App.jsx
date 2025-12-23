import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Reminders from './pages/Reminders';
import PatientDetail from './pages/PatientDetail';

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />

            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/:id" element={<PatientDetail />} />
                <Route path="reminders" element={<Reminders />} />
                <Route path="activity" element={<div>Activity</div>} />
                <Route path="location" element={<div>Location</div>} />
            </Route>
        </Routes>
    );
}

export default App;