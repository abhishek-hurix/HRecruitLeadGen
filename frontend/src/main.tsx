import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';
import { initCandidateAuth } from './api/client';
import { initVisitorId, getLockedDeviceCategory } from './utils/visitor';
import { AdminAuthProvider } from './contexts/AdminAuthContext';

initCandidateAuth();
initVisitorId();
getLockedDeviceCategory();

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AdminAuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AdminAuthProvider>
      </GoogleOAuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
