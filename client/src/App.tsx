import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import DatabaseViewer from './pages/DatabaseViewer';
import AggregatedMetrics from './pages/AggregatedMetrics';
import BuyBoxDashboard from './pages/BuyBoxDashboard';
import AmazonDataViewer from './pages/AmazonDataViewer';
import InsightsDashboard from './pages/InsightsDashboardDirect';
import Header from './components/Header';
import CredentialsConfig from './components/CredentialsConfig';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              borderLeft: '4px solid #FF8C00',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }
          }}
        />
        
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login setIsAuthenticated={setIsAuthenticated} />
          } />
          
          <Route path="/dashboard" element={
            isAuthenticated ? (
              <>
                <Header />
                <Dashboard />
              </>
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/credentials" element={
            isAuthenticated ? (
              <>
                <Header />
                <CredentialsConfig />
              </>
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/database" element={
            isAuthenticated ? (
              <>
                <Header />
                <DatabaseViewer />
              </>
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/aggregated-metrics" element={
            isAuthenticated ? (
              <>
                <Header />
                <AggregatedMetrics />
              </>
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/buy-box-dashboard" element={
            isAuthenticated ? (
              <>
                <Header />
                <BuyBoxDashboard />
              </>
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/amazon-data" element={
            isAuthenticated ? (
              <>
                <Header />
                <AmazonDataViewer />
              </>
            ) : <Navigate to="/login" />
          } />
          
          <Route path="/insights" element={
            <>
              <Header />
              <InsightsDashboard />
            </>
          } />
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;