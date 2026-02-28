import { useRef, useState } from 'react';

function UploadZone({ onFilesSelected }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);

    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleChooseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleChooseFolder = () => {
    folderInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = '';
  };

  return (
    <div
      className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="upload-zone-text">Drag images, folders, or .zip files here</p>
      <div className="upload-zone-buttons">
        <button className="upload-select-button" onClick={handleChooseFiles} type="button">
          Add Files / .zip
        </button>
        <button className="upload-select-button" onClick={handleChooseFolder} type="button">
          Add Folder
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.zip,application/zip,application/x-zip-compressed"
        onChange={handleFileChange}
        className="visually-hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        accept="image/*"
        onChange={handleFileChange}
        className="visually-hidden"
      />
    </div>
  );
}

export default UploadZone;
