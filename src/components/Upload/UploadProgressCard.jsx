function UploadProgressCard({ progress, className = '' }) {
  if (!progress?.isVisible) {
    return null;
  }

  const statusText = progress.isComplete
    ? 'All uploaded memes are ready.'
    : 'Progress increases only after each meme finishes uploading and AI analysis completes.';

  return (
    <section className={`upload-progress-card ${className}`.trim()}>
      <div className="upload-progress-header">
        <div>
          <h2 className="upload-progress-title">Upload Progress</h2>
          <p className="upload-progress-copy">{statusText}</p>
        </div>
        <div className="upload-progress-count">
          {progress.completed}/{progress.total}
        </div>
      </div>

      <div
        className="upload-progress-track"
        role="progressbar"
        aria-valuenow={progress.completed}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label="Uploaded memes ready"
      >
        <div className="upload-progress-fill" style={{ width: `${progress.percent}%` }} />
      </div>

      {progress.failed > 0 ? (
        <p className="upload-progress-meta">
          {progress.failed} meme{progress.failed === 1 ? '' : 's'} failed AI analysis and are not counted as complete.
        </p>
      ) : (
        <p className="upload-progress-meta">
          Ready memes: {progress.completed} of {progress.total}
        </p>
      )}
    </section>
  );
}

export default UploadProgressCard;
