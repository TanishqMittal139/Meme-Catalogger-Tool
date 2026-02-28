import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deleteMemeById, getMemes } from '../data/memeStorage';

function MemeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [memes, setMemes] = useState(() => getMemes());

  const memeId = Number(id);
  const meme = useMemo(() => memes.find((item) => item.id === memeId) || null, [memes, memeId]);

  if (!meme) {
    return (
      <div className="page-container centered-state">
        <h1 className="page-title">Meme Not Found</h1>
        <button className="btn btn-pill" onClick={() => navigate('/')}>
          Return
        </button>
      </div>
    );
  }

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete "${meme.title}"?`);
    if (!confirmed) return;

    const updatedMemes = deleteMemeById(memeId);
    setMemes(updatedMemes);
    navigate('/');
  };

  const handleDownload = () => {
    window.open(meme.image, '_blank');
  };

  return (
    <div className="meme-detail page-container">
      <div className="detail-top-row">
        <button className="btn btn-pill" onClick={() => navigate('/')}>
          Return
        </button>
        <button className="btn btn-circle" onClick={handleDownload}>
          Edit
        </button>
      </div>

      <h1 className="page-title detail-title">View Meme</h1>
      <p className="detail-subtitle">(When Clicked)</p>

      <div className="detail-layout">
        <div className="detail-image-wrap">
          <img src={meme.image} alt={meme.title} className="meme-detail-image" />
        </div>

        <div className="detail-right">
          <div className="detail-pill-field">{meme.title}</div>

          <div className="detail-pill-label">Caption</div>
          <div className="detail-box">{meme.title}</div>

          <div className="meme-detail-actions">
            <button className="btn btn-pill btn-danger-soft" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemeDetailPage;
