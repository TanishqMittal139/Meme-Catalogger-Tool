import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';

function Navbar() {
  const location = useLocation();
  const isCatalogActive = location.pathname === '/';
  const isUploadActive = location.pathname.startsWith('/upload') || location.pathname.startsWith('/meme');

  return (
    <nav className="navbar">
      <div className="nav-strip">
        <Link to="/" className="nav-tab nav-logo-tab">
          <img src={logo} alt="Meme Catalogger Logo" className="navbar-logo" />
        </Link>
        <Link to="/" className={`nav-tab ${isCatalogActive ? 'active' : ''}`}>
          Catalog
        </Link>
        <Link to="/upload" className={`nav-tab ${isUploadActive ? 'active' : ''}`}>
          Upload
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;
