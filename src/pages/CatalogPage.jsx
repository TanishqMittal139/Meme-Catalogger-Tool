import { useEffect, useMemo, useState } from 'react';
import SearchBar from '../components/Catalog/SearchBar';
import MemeGrid from '../components/Catalog/MemeGrid';
import { getMemes } from '../data/memeApi';
import UploadProgressCard from '../components/Upload/UploadProgressCard';
import { useUploadBatchProgress } from '../data/uploadProgress';

function CatalogPage() {
  const [memes, setMemes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const uploadProgress = useUploadBatchProgress();

  useEffect(() => {
    let isCancelled = false;

    const loadMemes = async (showLoadingState = false) => {
      if (showLoadingState) {
        setIsLoading(true);
      }
      setLoadError('');

      try {
        const fetchedMemes = await getMemes();
        if (!isCancelled) {
          setMemes(fetchedMemes);
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadError(error.message || 'Could not load memes.');
        }
      } finally {
        if (!isCancelled && showLoadingState) {
          setIsLoading(false);
        }
      }
    };

    loadMemes(true);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!memes.some((meme) => meme.aiStatus === 'queued' || meme.aiStatus === 'processing')) {
      return undefined;
    }

    const pollHandle = window.setInterval(async () => {
      try {
        const fetchedMemes = await getMemes();
        setMemes(fetchedMemes);
        setLoadError('');
      } catch (error) {
        setLoadError(error.message || 'Could not load memes.');
      }
    }, 4000);

    return () => window.clearInterval(pollHandle);
  }, [memes]);

  const filteredMemes = useMemo(() => {
    if (!query.trim()) return memes;

    const searchLower = query.toLowerCase();
    return memes.filter(
      (meme) =>
        meme.title.toLowerCase().includes(searchLower) ||
        (meme.keywords || []).some((keyword) => keyword.toLowerCase().includes(searchLower))
    );
  }, [memes, query]);

  const popularMemes = useMemo(
    () => [...memes].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)),
    [memes]
  );

  const showingSearchResults = query.trim().length > 0;

  return (
    <div className="catalog-page">
      <div className="page-container catalog-hero">
        <h1 className="page-title">MEME CATALOGER</h1>
        <p className="page-subtitle">A Smarter Way to Manage Memes</p>
        <SearchBar onSearch={setQuery} />
        <UploadProgressCard progress={uploadProgress} className="catalog-progress-card" />
      </div>

      <section>
        <div className="catalog-section">
          <h2 className="section-header">
            {showingSearchResults ? 'Search Result:' : 'Mostly Recently Used:'}
          </h2>
          <div className="grid-container">
            {isLoading ? (
              <p>Loading memes...</p>
            ) : loadError ? (
              <p>{loadError}</p>
            ) : (
              <MemeGrid memes={showingSearchResults ? filteredMemes : popularMemes.slice(0, 4)} />
            )}
          </div>
        </div>
      </section>

      {!showingSearchResults && !isLoading && !loadError && (
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
