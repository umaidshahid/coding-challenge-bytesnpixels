import { API_URL } from './config'
import { CustomerProfile, FeedbackItem, InternalNote, Metrics, User } from './types'

// Single fetch wrapper so every call fails loudly (throws) on a non-2xx
// response instead of silently returning an error body as if it were data.
async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  }
  if (init.body) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error('Login failed')
  }
  return res.json()
}

export function fetchInbox(
  page: number,
  status: string,
  search: string,
  token: string
): Promise<{ items: FeedbackItem[]; total: number; page: number }> {
  const params = new URLSearchParams({ page: String(page), status, q: search })
  return request(`/feedback?${params.toString()}`, token)
}

export function fetchItem(id: number, token: string): Promise<FeedbackItem> {
  return request(`/feedback/${id}`, token)
}

export function setResolved(
  id: number,
  status: 'open' | 'resolved',
  token: string
): Promise<FeedbackItem> {
  return request(`/feedback/${id}/resolve`, token, {
    method: 'POST',
    body: JSON.stringify({ status }),
  })
}

export function fetchUsers(token: string): Promise<{ users: User[] }> {
  return request('/users', token)
}

export function fetchMetrics(token: string): Promise<Metrics> {
  return request('/metrics', token)
}

export function exportFeedbackUrl(status: string, search: string, token: string) {
  const params = new URLSearchParams({ status, q: search, token })
  return `${API_URL}/export.csv?${params.toString()}`
}

export function fetchCustomer(id: number, token: string): Promise<CustomerProfile> {
  return request(`/customers/${id}`, token)
}

export function updateAssignment(
  id: number,
  data: { assignee_id: number | null; priority: string; due_at: string },
  token: string
): Promise<FeedbackItem> {
  return request(`/feedback/${id}/assignment`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function fetchNotes(id: number, token: string): Promise<{ notes: InternalNote[] }> {
  return request(`/feedback/${id}/notes`, token)
}

export function addNote(
  id: number,
  data: { body: string; is_private: boolean },
  token: string
): Promise<InternalNote> {
  return request(`/feedback/${id}/notes`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function summarize(id: number, token: string): Promise<{ summary: string }> {
  return request('/summarize', token, {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}
