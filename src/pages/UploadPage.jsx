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

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

const isImageFile = (fileName, mimeType = '') =>
  mimeType.startsWith('image/') ||
  imageExtensions.some((extension) => fileName.toLowerCase().endsWith(extension));

const isZipFile = (fileName, mimeType = '') =>
  mimeType === 'application/zip' ||
  mimeType === 'application/x-zip-compressed' ||
  fileName.toLowerCase().endsWith('.zip');

const getMimeTypeFromName = (fileName) => {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.bmp')) return 'image/bmp';
  return 'image/jpeg';
};

const extractImagesFromZip = async (zipFile) => {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.values(zip.files).filter(
    (entry) => !entry.dir && isImageFile(entry.name)
  );

  const extractedFiles = await Promise.all(
    entries.map(async (entry) => {
      const blob = await entry.async('blob');
      const fileName = entry.name.split('/').pop() || `meme-${Date.now()}.jpg`;
      return new File([blob], fileName, {
        type: blob.type || getMimeTypeFromName(fileName)
      });
    })
  );

  return extractedFiles;
};

function UploadPage() {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [uploadedFiles]);

  const handleFilesSelected = async (files) => {
    if (!files.length) return;

    setIsPreparingFiles(true);
    try {
      const resolvedFiles = [];

      for (const file of files) {
        if (isImageFile(file.name, file.type)) {
          resolvedFiles.push(file);
          continue;
        }

        if (isZipFile(file.name, file.type)) {
          const extracted = await extractImagesFromZip(file);
          resolvedFiles.push(...extracted);
        }
      }

      if (!resolvedFiles.length) {
        alert('No image files were found in the selected files/folder/zip.');
        return;
      }

      const newFiles = resolvedFiles.map((file) => ({
        id: Date.now() + Math.random(),
        file,
        preview: URL.createObjectURL(file),
        name: file.name
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);
    } catch (error) {
      alert(error.message || 'Could not process selected files.');
    } finally {
      setIsPreparingFiles(false);
    }
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
    if (uploadedFiles.length === 0 || isSaving || isPreparingFiles) return;

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
        <button className="btn btn-long" onClick={handleUpload} disabled={isSaving || isPreparingFiles}>
          {isPreparingFiles ? 'Preparing Files...' : 'Upload Meme'}
        </button>
      </div>
    </div>
  );
}

export default UploadPage;
