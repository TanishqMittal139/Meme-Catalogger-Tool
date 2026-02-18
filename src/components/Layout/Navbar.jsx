import { Link, useLocation } from 'react-router-dom';
import logo from '../../assets/logo.png';

function Navbar() {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={logo} alt="Meme Catalogger Logo" className="navbar-logo" />
      </Link>
      
      <ul className="navbar-links">
        <li>
          <Link to="/" className={isActive('/') ? 'active' : ''}>
            Catalog
          </Link>
        </li>
        <li>
          <Link to="/upload" className={isActive('/upload') ? 'active' : ''}>
            Upload
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
