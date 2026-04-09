import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Favorites from './pages/Favorites';
import About from './pages/About';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/stations"  element={<Home />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/about"     element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;