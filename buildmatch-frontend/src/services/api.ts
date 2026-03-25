import axios from 'axios';

const TOKEN_KEY = 'buildmatch_token';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    // Only force-logout on 401s outside of auth endpoints to avoid
    // redirect loops when submitting login/register credentials
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !error.config?.url?.includes('/auth/')
    ) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
export default api;
