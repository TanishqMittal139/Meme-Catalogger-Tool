import MemeCard from '../Meme/MemeCard';

function MemeGrid({ memes }) {
  if (memes.length === 0) {
    return (
      <div className="page-container" style={{ textAlign: 'center' }}>
        <p>No memes found. Try a different search term.</p>
      </div>
    );
  }

  return (
    <div className="meme-grid">
      {memes.map((meme) => (
        <MemeCard key={meme.id} meme={meme} />
      ))}
    </div>
  );
}

export default MemeGrid;
