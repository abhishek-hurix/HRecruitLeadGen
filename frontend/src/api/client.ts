import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

export function setAuthToken(token: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function clearAuthToken() {
  delete api.defaults.headers.common['Authorization'];
}

export function setCandidateToken(token: string) {
  localStorage.setItem('candidate_token', token);
  localStorage.removeItem('admin_token');
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function getCandidateToken(): string | null {
  return localStorage.getItem('candidate_token');
}

export function clearCandidateToken() {
  localStorage.removeItem('candidate_token');
  delete api.defaults.headers.common['Authorization'];
}

export function setAdminToken(token: string) {
  localStorage.setItem('admin_token', token);
  localStorage.removeItem('candidate_token');
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function getAdminToken(): string | null {
  return localStorage.getItem('admin_token');
}

export function clearAdminToken() {
  localStorage.removeItem('admin_token');
  delete api.defaults.headers.common['Authorization'];
}

export function initCandidateAuth() {
  const candidateToken = getCandidateToken();
  const adminToken = getAdminToken();
  if (adminToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${adminToken}`;
  } else if (candidateToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${candidateToken}`;
  }
}
