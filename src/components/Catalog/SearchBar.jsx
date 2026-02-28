import { useState } from 'react';

function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleChange = (e) => {
    const next = e.target.value;
    setQuery(next);
    onSearch(next);
  };

  return (
    <div className="search-container">
      <form className="search-bar" onSubmit={handleSubmit}>
        <input type="text" placeholder="Search" value={query} onChange={handleChange} />
        <button type="submit" className="search-button" aria-label="Search">
          <span className="search-icon" />
        </button>
      </form>
    </div>
  );
}

export default SearchBar;
