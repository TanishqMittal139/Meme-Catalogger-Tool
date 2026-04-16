import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildMemeImageLink, copyTextToClipboard } from '../../utils/clipboard';

function MemeCard({ meme }) {
  const navigate = useNavigate();
  const [copyState, setCopyState] = useState('idle');

  const handleClick = () => {
    navigate(`/meme/${meme.id}`);
  };

  const handleCopy = async (event) => {
    event.stopPropagation();

    try {
      const memeLink = buildMemeImageLink(meme.id);
      const result = await copyTextToClipboard(memeLink);
      setCopyState(result.manual ? 'manual' : 'copied');
      window.setTimeout(() => setCopyState('idle'), 1400);
    } catch {
      setCopyState('failed');
      window.setTimeout(() => setCopyState('idle'), 1800);
    }
  };

  return (
    <div className="meme-card" onClick={handleClick}>
      <div className="meme-image-box">
        <img src={meme.image} alt={meme.title} />
        <button
          className={`meme-copy-button ${copyState === 'copied' ? 'is-success' : ''} ${copyState === 'manual' ? 'is-manual' : ''} ${copyState === 'failed' ? 'is-failure' : ''}`.trim()}
          onClick={handleCopy}
          type="button"
        >
          {copyState === 'copied' ? 'Copied!' : copyState === 'manual' ? 'Link Ready' : copyState === 'failed' ? 'Failed' : 'Copy'}
        </button>
      </div>

      <div className="meme-card-info">
        <div className="meme-card-title">{meme.title}</div>
        {meme.aiStatus === 'queued' || meme.aiStatus === 'processing' ? (
          <div className="meme-card-status">Analyzing...</div>
        ) : null}
        {meme.aiStatus === 'failed' ? <div className="meme-card-status">AI analysis failed</div> : null}
      </div>
    </div>
  );
}

export default MemeCard;
