import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import CatalogPage from './pages/CatalogPage';
import UploadPage from './pages/UploadPage';
import MemeDetailPage from './pages/MemeDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/meme/:id" element={<MemeDetailPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
