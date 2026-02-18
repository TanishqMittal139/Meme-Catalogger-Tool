import { useState } from 'react';
import SearchBar from '../components/Catalog/SearchBar';
import MemeGrid from '../components/Catalog/MemeGrid';
import { mockMemes } from '../data/mockMemes';

function CatalogPage() {
  const [filteredMemes, setFilteredMemes] = useState(mockMemes);

  const handleSearch = (query) => {
    if (!query.trim()) {
      setFilteredMemes(mockMemes);
      return;
    }

    const searchLower = query.toLowerCase();
    const results = mockMemes.filter(meme => 
      meme.title.toLowerCase().includes(searchLower) ||
      meme.keywords.some(keyword => keyword.toLowerCase().includes(searchLower))
    );
    setFilteredMemes(results);
  };

  // Sort by downloads for "Most Popular" section
  const popularMemes = [...mockMemes].sort((a, b) => b.downloads - a.downloads);

  return (
    <div>
      <div className="page-container">
        <h1 className="page-title">Meme Catalogger</h1>
        <SearchBar onSearch={handleSearch} />
      </div>
      
      <section>
        <div className="catalog-section">
          <h2 className="section-header">Most Popular</h2>
          <div className="grid-container">
          <MemeGrid
            memes={
              filteredMemes.length === mockMemes.length
                ? popularMemes.slice(0, 4)
                : filteredMemes
            }
          />
          </div>
        </div>
      </section>

      {filteredMemes.length === mockMemes.length && (
        <section>
          <div className="catalog-section">
            <h2 className="section-header">All Memes</h2>
            <div className="grid-container">
            <MemeGrid memes={mockMemes} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default CatalogPage;
