const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const apiCall = async (endpoint, method = 'GET', data = null) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const config = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const errorMessage = errorBody?.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
