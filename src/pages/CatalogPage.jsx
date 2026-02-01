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
        <h1 className="page-title">Meme Catalog</h1>
        <SearchBar onSearch={handleSearch} />
      </div>
      
      <section>
        <h2 className="section-header">Most Popular</h2>
        <MemeGrid memes={filteredMemes.length === mockMemes.length ? popularMemes.slice(0, 4) : filteredMemes} />
      </section>
      
      {filteredMemes.length === mockMemes.length && (
        <section>
          <h2 className="section-header">All Memes</h2>
          <MemeGrid memes={mockMemes} />
        </section>
      )}
    </div>
  );
}

export default CatalogPage;
