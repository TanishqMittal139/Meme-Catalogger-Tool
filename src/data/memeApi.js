const API_BASE = '/api';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // Keep the default message when response is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const getMemes = () => request('/memes');

export const getMemeById = (id) => request(`/memes/${id}`);

export const createMemes = (memes) =>
  request('/memes', {
    method: 'POST',
    body: JSON.stringify({ memes })
  }).then((result) => result.memes || []);

export const updateMemeById = (id, updates) =>
  request(`/memes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });

export const deleteMemeById = (id) =>
  request(`/memes/${id}`, {
    method: 'DELETE'
  });

export const reanalyzeMemeById = (id) =>
  request(`/memes/${id}/reanalyze`, {
    method: 'POST'
  });
