import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const location = useLocation();
  
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        Meme Catalogger
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
        <li>
          <Link to="/signin" className={isActive('/signin') ? 'active' : ''}>
            Sign In
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
