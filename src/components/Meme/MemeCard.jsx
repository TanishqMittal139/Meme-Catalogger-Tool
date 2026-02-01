import { useNavigate } from 'react-router-dom';

function MemeCard({ meme }) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/meme/${meme.id}`);
  };

  return (
    <div className="meme-card" onClick={handleClick}>
      <img src={meme.image} alt={meme.title} />
      <div className="meme-card-info">
        <div className="meme-card-title">{meme.title}</div>
        <div className="meme-card-stats">
          {meme.downloads.toLocaleString()} downloads
        </div>
      </div>
    </div>
  );
}

export default MemeCard;
