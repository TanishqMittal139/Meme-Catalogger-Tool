import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import CatalogPage from './pages/CatalogPage';
import UploadPage from './pages/UploadPage';
import SignInPage from './pages/SignInPage';
import CreateAccountPage from './pages/CreateAccountPage';
import MemeDetailPage from './pages/MemeDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/create-account" element={<CreateAccountPage />} />
        <Route path="/meme/:id" element={<MemeDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
