import { useParams, useNavigate } from 'react-router-dom';
import { mockMemes } from '../data/mockMemes';

function MemeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const memeIndex = mockMemes.findIndex(m => m.id === parseInt(id));
  const meme = memeIndex === -1 ? null : mockMemes[memeIndex];

  if (!meme) {
    return (
      <div className="page-container" style={{ textAlign: 'center' }}>
        <h1 className="page-title">Meme Not Found</h1>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Back to Catalog
        </button>
      </div>
    );
  }

  const handleDownload = () => {
    window.open(meme.image, '_blank');
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete "${meme.title}"?`);
    if (!confirmed) return;

    mockMemes.splice(memeIndex, 1);
    navigate('/');
  };

  return (
    <div className="meme-detail">
      <img
        src={meme.image}
        alt={meme.title}
        className="meme-detail-image"
      />

      <div className="meme-detail-info">
        <h1 className="meme-detail-title">{meme.title}</h1>
        <p>Uploaded by: {meme.uploadedBy}</p>
        <p>Downloads: {meme.downloads.toLocaleString()}</p>
        <p>Keywords: {meme.keywords.join(', ')}</p>

        <div className="meme-detail-actions">
          <button className="btn btn-primary" onClick={handleDownload}>
            Download
          </button>

          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>

          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Back to Catalog
          </button>
        </div>
      </div>
    </div>
  );
}

export default MemeDetailPage;
