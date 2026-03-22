import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { deleteMemeById, getMemeById, updateMemeById } from '../data/memeApi';

function MemeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meme, setMeme] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    title: '',
    caption: '',
    tags: ''
  });

  const memeId = Number(id);

  useEffect(() => {
    const loadMeme = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const fetchedMeme = await getMemeById(memeId);
        setMeme(fetchedMeme);
      } catch (error) {
        setMeme(null);
        setLoadError(error.message || 'Could not load meme.');
      } finally {
        setIsLoading(false);
      }
    };

    if (!Number.isFinite(memeId)) {
      setLoadError('Invalid meme id.');
      setIsLoading(false);
      return;
    }

    loadMeme();
  }, [memeId]);

  useEffect(() => {
    if (!meme) return;
    setEditFields({
      title: meme.title || '',
      caption: meme.caption || meme.title || '',
      tags: (meme.keywords || []).join(', ')
    });
  }, [meme]);

  if (isLoading) {
    return (
      <div className="page-container centered-state">
        <h1 className="page-title">Loading Meme...</h1>
      </div>
    );
  }

  if (!meme) {
    return (
      <div className="page-container centered-state">
        <h1 className="page-title">{loadError || 'Meme Not Found'}</h1>
        <button className="btn btn-pill" onClick={() => navigate('/')}>
          Return
        </button>
      </div>
    );
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(`Delete "${meme.title}"?`);
    if (!confirmed) return;

    try {
      await deleteMemeById(memeId);
      navigate('/');
    } catch (error) {
      alert(error.message || 'Delete failed.');
    }
  };

  const handleDownload = () => {
    const safeFileName = (meme.title || 'meme')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const isPngDataUrl = typeof meme.image === 'string' && meme.image.startsWith('data:image/png');
    const extension = isPngDataUrl ? 'png' : 'jpg';

    const anchor = document.createElement('a');
    anchor.href = meme.image;
    anchor.download = `${safeFileName || 'meme'}.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleEditFieldChange = (field) => (event) => {
    const { value } = event.target;
    setEditFields((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    const cleanedTitle = editFields.title.trim() || 'Untitled Meme';
    const cleanedCaption = editFields.caption.trim() || cleanedTitle;
    const cleanedKeywords = editFields.tags
      .split(/[\n,]/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean);

    const uniqueKeywords = Array.from(new Set(cleanedKeywords));

    try {
      const updatedMeme = await updateMemeById(memeId, {
        title: cleanedTitle,
        caption: cleanedCaption,
        keywords: uniqueKeywords
      });

      setMeme(updatedMeme);
      setIsEditing(false);
    } catch (error) {
      alert(error.message || 'Save failed.');
    }
  };

  const handleCopy = async () => {
    try {
      const response = await fetch(meme.image);
      const blob = await response.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      return;
    } catch {
      try {
        await navigator.clipboard.writeText(meme.image);
        return;
      } catch {
        window.prompt('Copy meme link:', meme.image);
      }
    }
  };

  const caption = meme.caption || meme.title || 'No caption provided.';
  const tags = meme.keywords?.length ? meme.keywords.map((tag) => `#${tag}`) : ['#meme'];
  const isAnalyzing = meme.aiStatus === 'queued' || meme.aiStatus === 'processing';

  return (
    <div className="meme-detail page-container">
      <div className="detail-top-row">
        <button className="btn btn-pill" onClick={() => navigate('/')}>
          Return
        </button>
        {isEditing ? (
          <>
            <button className="btn btn-pill" onClick={handleSave} type="button">
              Save
            </button>
            <button className="btn btn-pill btn-danger-soft" onClick={handleDelete} type="button">
              Delete
            </button>
          </>
        ) : (
          <button className="btn btn-circle" onClick={handleEdit} type="button">
            Edit
          </button>
        )}
      </div>

      <h1 className="page-title detail-title">{isEditing ? 'Edit Meme' : 'View Meme'}</h1>

      <div className="detail-layout">
        <div className="detail-image-wrap">
          <img src={meme.image} alt={meme.title} className="meme-detail-image" />
        </div>

        <div className="detail-right">
          {isAnalyzing ? <p>Analyzing meme metadata in the background...</p> : null}
          {meme.aiStatus === 'failed' && meme.aiError ? <p>AI analysis failed: {meme.aiError}</p> : null}

          {isEditing ? (
            <input
              className="detail-pill-field detail-edit-input"
              value={editFields.title}
              onChange={handleEditFieldChange('title')}
              placeholder="Meme title"
            />
          ) : (
            <div className="detail-pill-field">{meme.title || 'Untitled Meme'}</div>
          )}

          <div className="detail-pill-label">Caption</div>
          {isEditing ? (
            <textarea
              className="detail-box detail-caption detail-edit-textarea"
              value={editFields.caption}
              onChange={handleEditFieldChange('caption')}
              placeholder="Write a caption"
            />
          ) : (
            <div className="detail-box detail-caption">{caption}</div>
          )}

          <div className="detail-pill-label">Tags</div>
          {isEditing ? (
            <textarea
              className="detail-box detail-tags detail-edit-textarea"
              value={editFields.tags}
              onChange={handleEditFieldChange('tags')}
              placeholder="tag1, tag2, tag3"
            />
          ) : (
            <div className="detail-box detail-tags">
              {tags.map((tag) => (
                <p key={tag}>{tag}</p>
              ))}
            </div>
          )}

          {!isEditing && (
            <div className="meme-detail-actions">
              <button className="btn btn-pill detail-action-btn" onClick={handleCopy}>
                Copy Meme
              </button>
              <button className="btn btn-pill detail-action-btn" onClick={handleDownload}>
                Download Meme
              </button>
              <button className="btn btn-pill btn-danger-soft" onClick={handleDelete}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MemeDetailPage;
