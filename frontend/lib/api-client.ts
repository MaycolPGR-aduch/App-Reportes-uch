export type IncidentCategory = "INFRASTRUCTURE" | "SECURITY" | "CLEANING";
export type IncidentStatus =
  | "REPORTED"
  | "IN_REVIEW"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type UserRole = "STUDENT" | "STAFF" | "ADMIN";

export type IncidentListItem = {
  id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  priority: PriorityLevel;
  description: string;
  created_at: string;
  reporter_campus_id: string;
};

export type IncidentListResponse = {
  total: number;
  items: IncidentListItem[];
};

export type IncidentDetail = {
  id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  priority: PriorityLevel;
  description: string;
  trace_id: string | null;
  created_at: string;
  updated_at: string;
  reporter_campus_id: string;
  reporter_name: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy_m: number | null;
    reference: string | null;
    captured_at: string;
  } | null;
  evidences: Array<{
    id: string;
    storage_path: string;
    mime_type: string;
    file_size_bytes: number;
    sha256_hash: string;
    metadata_json: Record<string, unknown> | null;
    created_at: string;
  }>;
  ai_metrics: Array<{
    id: string;
    model_name: string;
    prompt_version: string;
    predicted_category: IncidentCategory;
    priority_score: string;
    priority_label: PriorityLevel;
    confidence: string;
    latency_ms: number;
    reasoning_summary: string;
    created_at: string;
  }>;
  notifications: Array<{
    id: string;
    recipient: string;
    status: "PENDING" | "SENT" | "FAILED";
    channel: "EMAIL";
    subject: string;
    sent_at: string | null;
    created_at: string;
  }>;
};

export type LoginResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in_seconds: number;
  role: UserRole;
  campus_id: string;
};

export type PublicRegisterPayload = {
  campus_id: string;
  full_name: string;
  email: string;
  password: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

async function parseError(response: Response): Promise<never> {
  let message = "Error inesperado";
  try {
    const body = (await response.json()) as { detail?: string };
    if (body.detail) {
      message = body.detail;
    }
  } catch {
    message = response.statusText || message;
  }
  throw new Error(`${response.status} - ${message}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    return parseError(response);
  }
  return (await response.json()) as T;
}

export async function login(campusId: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campus_id: campusId, password }),
  });
}

export async function registerUser(payload: PublicRegisterPayload): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createReport(
  token: string | null,
  formData: FormData,
): Promise<{
  incident_id: string;
  status: IncidentStatus;
  created_at: string;
  ai_status: string;
}> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return request("/reports", {
    method: "POST",
    headers,
    body: formData,
  });
}

export async function listIncidents(
  token: string,
  params: {
    status_filter?: IncidentStatus;
    category?: IncidentCategory;
    priority?: PriorityLevel;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  },
): Promise<IncidentListResponse> {
  const query = new URLSearchParams();
  if (params.status_filter) query.set("status_filter", params.status_filter);
  if (params.category) query.set("category", params.category);
  if (params.priority) query.set("priority", params.priority);
  if (params.date_from) query.set("date_from", params.date_from);
  if (params.date_to) query.set("date_to", params.date_to);
  query.set("limit", String(params.limit ?? 20));
  query.set("offset", String(params.offset ?? 0));

  return request<IncidentListResponse>(`/incidents?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getIncidentDetail(token: string, incidentId: string): Promise<IncidentDetail> {
  return request<IncidentDetail>(`/incidents/${incidentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getEvidenceObjectUrl(
  token: string,
  incidentId: string,
  evidenceId: string,
): Promise<string> {
  const response = await fetch(
    `${API_BASE}/incidents/${incidentId}/evidences/${evidenceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    return parseError(response);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
