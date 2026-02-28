import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from '../components/Upload/UploadZone';
import { addMemes } from '../data/memeStorage';

const getTitleFromName = (fileName) => {
  const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
  return nameWithoutExtension || 'Untitled Meme';
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
    reader.readAsDataURL(file);
  });

function UploadPage() {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [uploadedFiles]);

  const handleFilesSelected = (files) => {
    const newFiles = files.map((file) => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev.find((file) => file.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((file) => file.id !== id);
    });
  };

  const handleUpload = async () => {
    if (uploadedFiles.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const memesToSave = await Promise.all(
        uploadedFiles.map(async (fileEntry) => ({
          title: getTitleFromName(fileEntry.name),
          image: await fileToDataUrl(fileEntry.file),
          downloads: 0,
          uploadedBy: 'you',
          keywords: []
        }))
      );

      addMemes(memesToSave);
      uploadedFiles.forEach((file) => URL.revokeObjectURL(file.preview));
      setUploadedFiles([]);
      navigate('/');
    } catch (error) {
      alert(error.message || 'Upload failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="upload-page page-container">
      <h1 className="page-title">Upload</h1>

      <UploadZone onFilesSelected={handleFilesSelected} />

      {uploadedFiles.length > 0 && (
        <div className="upload-preview-grid">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="upload-preview-item">
              <img src={file.preview} alt={file.name} />
              <button className="upload-preview-remove" onClick={() => handleRemoveFile(file.id)}>
                x
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="upload-actions">
        <button className="btn btn-long" onClick={handleUpload} disabled={isSaving}>
          Upload Meme
        </button>
      </div>
    </div>
  );
}

export default UploadPage;
