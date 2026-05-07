import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Web3Provider } from './context/Web3Context';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import UploaderDashboard from './pages/UploaderDashboard';
import VerifierDashboard from './pages/VerifierDashboard';
import ApproverDashboard from './pages/ApproverDashboard';
import StudentDashboard from './pages/StudentDashboard';
import EmployerDashboard from './pages/EmployerDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';

function App() {
  return (
    <AuthProvider>
      <Web3Provider>
        <Router future={{ v7_relativeSplatPath: true }}>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/uploader"
                element={
                  <ProtectedRoute>
                    <UploaderDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verifier"
                element={
                  <ProtectedRoute>
                    <VerifierDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/approver"
                element={
                  <ProtectedRoute>
                    <ApproverDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student"
                element={
                  <ProtectedRoute>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/employer"
                element={
                  <ProtectedRoute>
                    <EmployerDashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Router>
      </Web3Provider>
    </AuthProvider>
  );
}

export default App;



