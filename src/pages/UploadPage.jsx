import { useState } from 'react';
import UploadZone from '../components/Upload/UploadZone';

function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const handleFilesSelected = (files) => {
    const newFiles = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id) => {
    setUploadedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleUpload = () => {
    // TODO: Implement actual upload logic in Phase 2
    console.log('Uploading files:', uploadedFiles);
    alert('Upload functionality will be implemented in Phase 2!');
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Upload Memes</h1>
      
      <UploadZone onFilesSelected={handleFilesSelected} />
      
      {uploadedFiles.length > 0 && (
        <>
          <div className="upload-preview-grid">
            {uploadedFiles.map(file => (
              <div key={file.id} className="upload-preview-item">
                <img src={file.preview} alt={file.name} />
                <button
                  className="upload-preview-remove"
                  onClick={() => handleRemoveFile(file.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={handleUpload}>
              Upload {uploadedFiles.length} Meme{uploadedFiles.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default UploadPage;
