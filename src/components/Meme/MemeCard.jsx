import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function MemeCard({ meme }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleClick = () => {
    navigate(`/meme/${meme.id}`);
  };

  const handleCopy = async (event) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(meme.image);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      window.prompt('Copy meme link:', meme.image);
    }
  };

  return (
    <div className="meme-card" onClick={handleClick}>
      <div className="meme-image-box">
        <img src={meme.image} alt={meme.title} />
        <button className="meme-copy-button" onClick={handleCopy} type="button">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="meme-card-info">
        <div className="meme-card-title">{meme.title}</div>
      </div>
    </div>
  );
}

export default MemeCard;
