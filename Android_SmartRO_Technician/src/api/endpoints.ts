import { api } from './client';

export interface Job {
  id: string;
  ticketId?: string | null;
  type: string;
  scheduledFor: string;
  status: 'SCHEDULED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  notes?: string | null;
  completedAt?: string | null;
  ticket?: {
    id: string;
    category: string;
    description: string;
    status: string;
    priority: string;
    user: { id: string; fullName: string | null; phone: string };
    device?: { serial: string } | null;
  };
}

export const Auth = {
  login: (email: string, password: string) =>
    api.post('/auth/admin/login', { email, password }).then((r) => r.data.data),
  logout: () => api.post('/auth/logout', {}).catch(() => undefined),
  me: () => api.get('/auth/me').then((r) => r.data.data),
};

export const Tech = {
  me: () => api.get('/technician/me').then((r) => r.data.data),
  todayJobs: () => api.get('/technician/jobs/today').then((r) => r.data.data as Job[]),
  allJobs: () => api.get('/technician/jobs').then((r) => r.data.data as Job[]),
  job: (id: string) => api.get(`/technician/jobs/${id}`).then((r) => r.data.data as Job),
  updateStatus: (id: string, status: Job['status'], notes?: string) =>
    api.patch(`/technician/jobs/${id}/status`, { status, notes }).then((r) => r.data.data as Job),
};
