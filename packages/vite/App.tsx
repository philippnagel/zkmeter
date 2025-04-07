// packages/vite/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import HomePage from './pages/HomePage.jsx';
import VerifierPage from './pages/VerifierPage.jsx';
import Header from './components/Header.jsx';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verifier" element={<VerifierPage />} />
          </Routes>
        </main>
        <ToastContainer 
          position="bottom-right"
          theme="colored"
          toastClassName="dark:bg-gray-800 dark:text-white"
        />
      </div>
    </Router>
  );
}

export default App;
