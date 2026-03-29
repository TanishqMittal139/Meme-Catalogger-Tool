import { useEffect, useState } from 'react';
import { getMemes } from './memeApi';

const STORAGE_KEY = 'meme-upload-batch';
const CHANGE_EVENT = 'meme-upload-batch-change';
const COMPLETION_RESET_DELAY_MS = 4000;
const POLL_INTERVAL_MS = 2500;

const isBrowser = typeof window !== 'undefined';

const parseBatch = (rawValue) => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed?.ids) || typeof parsed?.total !== 'number') {
      return null;
    }

    return {
      ids: parsed.ids.filter((id) => Number.isFinite(id)),
      total: parsed.total,
      startedAt: parsed.startedAt || Date.now()
    };
  } catch {
    return null;
  }
};

export const readUploadBatch = () => {
  if (!isBrowser) return null;
  return parseBatch(window.localStorage.getItem(STORAGE_KEY));
};

const emitBatchChange = () => {
  if (!isBrowser) return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const startUploadBatch = (ids) => {
  if (!isBrowser) return;

  const cleanedIds = ids.filter((id) => Number.isFinite(id));
  if (cleanedIds.length === 0) return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ids: cleanedIds,
      total: cleanedIds.length,
      startedAt: Date.now()
    })
  );
  emitBatchChange();
};

export const clearUploadBatch = () => {
  if (!isBrowser) return;
  window.localStorage.removeItem(STORAGE_KEY);
  emitBatchChange();
};

export function useUploadBatchProgress() {
  const [batch, setBatch] = useState(() => readUploadBatch());
  const [progress, setProgress] = useState({
    completed: 0,
    failed: 0,
    total: batch?.total || 0
  });

  useEffect(() => {
    if (!isBrowser) return undefined;

    const handleChange = () => {
      const nextBatch = readUploadBatch();
      setBatch(nextBatch);
      setProgress((prev) => ({
        completed: nextBatch ? Math.min(prev.completed, nextBatch.total) : 0,
        failed: nextBatch ? prev.failed : 0,
        total: nextBatch?.total || 0
      }));
    };

    window.addEventListener(CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);

    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!batch) {
      setProgress({ completed: 0, failed: 0, total: 0 });
      return undefined;
    }

    let isCancelled = false;
    let completionTimer;

    const pollProgress = async () => {
      try {
        const memes = await getMemes();
        if (isCancelled) return;

        const trackedMemes = batch.ids
          .map((id) => memes.find((meme) => meme.id === id))
          .filter(Boolean);

        const completed = trackedMemes.filter((meme) => meme.aiStatus === 'completed').length;
        const failed = trackedMemes.filter((meme) => meme.aiStatus === 'failed').length;

        setProgress({
          completed,
          failed,
          total: batch.total
        });

        if (completed >= batch.total) {
          completionTimer = window.setTimeout(() => {
            clearUploadBatch();
          }, COMPLETION_RESET_DELAY_MS);
        }
      } catch {
        // Keep the last known progress and try again on the next interval.
      }
    };

    pollProgress();
    const intervalHandle = window.setInterval(pollProgress, POLL_INTERVAL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalHandle);
      if (completionTimer) {
        window.clearTimeout(completionTimer);
      }
    };
  }, [batch]);

  if (!batch) {
    return {
      isVisible: false,
      total: 0,
      completed: 0,
      failed: 0,
      percent: 0,
      isComplete: false
    };
  }

  const total = progress.total || batch.total;
  const completed = Math.min(progress.completed, total);
  const failed = Math.min(progress.failed, Math.max(total - completed, 0));
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    isVisible: true,
    total,
    completed,
    failed,
    percent,
    isComplete: completed >= total
  };
}
