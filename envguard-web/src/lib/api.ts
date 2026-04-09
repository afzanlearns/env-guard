import axios from 'axios';

// Since we use Vite proxy for standard environments, we can rely on relative routes.
// The proxy will pass `withCredentials` correctly with cookies.
export const api = axios.create({
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add interceptor to uniformly catch 401 errors and perhaps trigger a re-login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If we are unauthorized and we are not already on the landing page, clean up state
      // (Handling handled safely via hook)
    }
    return Promise.reject(error);
  }
);
