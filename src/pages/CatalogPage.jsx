import { useMemo, useState } from 'react';
import SearchBar from '../components/Catalog/SearchBar';
import MemeGrid from '../components/Catalog/MemeGrid';
import { getMemes } from '../data/memeStorage';

function CatalogPage() {
  const [memes] = useState(() => getMemes());
  const [query, setQuery] = useState('');

  const filteredMemes = useMemo(() => {
    if (!query.trim()) return memes;

    const searchLower = query.toLowerCase();
    return memes.filter(
      (meme) =>
        meme.title.toLowerCase().includes(searchLower) ||
        meme.keywords.some((keyword) => keyword.toLowerCase().includes(searchLower))
    );
  }, [memes, query]);

  const popularMemes = useMemo(
    () => [...memes].sort((a, b) => b.downloads - a.downloads),
    [memes]
  );

  const showingSearchResults = query.trim().length > 0;

  return (
    <div className="catalog-page">
      <div className="page-container catalog-hero">
        <h1 className="page-title">MEME CATALOGER</h1>
        <p className="page-subtitle">A Smarter Way to Manage Memes</p>
        <SearchBar onSearch={setQuery} />
      </div>

      <section>
        <div className="catalog-section">
          <h2 className="section-header">
            {showingSearchResults ? 'Search Result:' : 'Mostly Recently Used:'}
          </h2>
          <div className="grid-container">
            <MemeGrid memes={showingSearchResults ? filteredMemes : popularMemes.slice(0, 4)} />
          </div>
        </div>
      </section>

      {!showingSearchResults && (
        <section>
          <div className="catalog-section">
            <h2 className="section-header">All Memes:</h2>
            <div className="grid-container">
              <MemeGrid memes={memes} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default CatalogPage;
