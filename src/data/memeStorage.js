const STORAGE_KEY = 'memeCataloggerMemes';

const defaultMemes = [
  {
    id: 1,
    title: 'Sample Meme',
    image: 'https://i.imgflip.com/1ur9b0.jpg',
    downloads: 15420,
    uploadedBy: 'system',
    keywords: ['sample', 'starter']
  }
];

const parseStoredMemes = (rawValue) => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const getMemes = () => {
  const storedMemes = parseStoredMemes(localStorage.getItem(STORAGE_KEY));
  if (storedMemes) return storedMemes;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMemes));
  return [...defaultMemes];
};

export const saveMemes = (memes) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memes));
};

export const addMemes = (newMemes) => {
  const existingMemes = getMemes();
  const maxId = existingMemes.reduce((max, meme) => Math.max(max, meme.id), 0);

  const memesToAdd = newMemes.map((meme, index) => ({
    ...meme,
    id: maxId + index + 1
  }));

  const updatedMemes = [...existingMemes, ...memesToAdd];
  saveMemes(updatedMemes);
  return updatedMemes;
};

export const deleteMemeById = (id) => {
  const existingMemes = getMemes();
  const updatedMemes = existingMemes.filter((meme) => meme.id !== id);
  saveMemes(updatedMemes);
  return updatedMemes;
};
