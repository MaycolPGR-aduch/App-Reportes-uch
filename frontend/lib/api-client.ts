export type IncidentCategory = "INFRASTRUCTURE" | "SECURITY" | "CLEANING";
export type IncidentStatus =
  | "REPORTED"
  | "IN_REVIEW"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type UserRole = "STUDENT" | "STAFF" | "ADMIN";
export type AssignmentStatus = "ASSIGNED" | "ACKNOWLEDGED" | "COMPLETED";
export type UserStatus = "ACTIVE" | "INACTIVE";

export type IncidentListItem = {
  id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  priority: PriorityLevel;
  description: string;
  created_at: string;
  reporter_campus_id: string;
  location_zone_name: string | null;
  location_status: string | null;
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
    resolved_zone_id: string | null;
    resolved_zone_name: string | null;
    location_status: string;
    location_confidence: number | null;
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
    raw_response: Record<string, unknown> | null;
    created_at: string;
  }>;
  assignments: Array<{
    id: string;
    responsible_id: string;
    responsible_name: string;
    responsible_area: string;
    responsible_email: string;
    responsible_phone: string | null;
    status: AssignmentStatus;
    notes: string | null;
    assigned_at: string;
    due_at: string | null;
    completed_at: string | null;
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

export type AdminUser = {
  id: string;
  campus_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
};

export type AdminUserListResponse = {
  total: number;
  items: AdminUser[];
};

export type SystemStatusResponse = {
  api_ok: boolean;
  server_time: string;
  queue_summary: Array<{
    job_type: "CLASSIFY_INCIDENT" | "SEND_NOTIFICATION";
    job_status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
    count: number;
  }>;
  workers: Array<{
    name: string;
    state: "ACTIVE" | "IDLE" | "STALE" | string;
    last_job_update_at: string | null;
    pending_jobs: number;
    processing_jobs: number;
  }>;
  gemini: {
    api_key_configured: boolean;
    model: string;
    state: string;
    fallback_count_24h: number;
    quota_exhausted_detected: boolean;
    latest_fallback_reason: string | null;
    latest_source: string | null;
  };
  notes: string[];
};

export type StaffMember = {
  id: string;
  full_name: string;
  area_name: string;
  email: string;
  phone_number: string | null;
  category: IncidentCategory;
  min_priority: PriorityLevel;
  is_active: boolean;
  pending_assignments: number;
  completed_assignments: number;
  created_at: string;
  updated_at: string;
};

export type StaffListResponse = {
  total: number;
  items: StaffMember[];
};

export type StaffAssignmentItem = {
  assignment_id: string;
  incident_id: string;
  incident_category: IncidentCategory;
  incident_priority: PriorityLevel;
  incident_status: IncidentStatus;
  incident_zone_name: string | null;
  assignment_status: AssignmentStatus;
  incident_description: string;
  assigned_at: string;
  due_at: string | null;
  completed_at: string | null;
};

export type StaffAssignmentListResponse = {
  total: number;
  items: StaffAssignmentItem[];
};

export type StaffOwnAssignmentItem = {
  assignment_id: string;
  responsible_id: string;
  responsible_area_name: string;
  incident_id: string;
  incident_category: IncidentCategory;
  incident_priority: PriorityLevel;
  incident_status: IncidentStatus;
  incident_zone_name: string | null;
  assignment_status: AssignmentStatus;
  incident_description: string;
  assigned_at: string;
  due_at: string | null;
  completed_at: string | null;
};

export type StaffOwnAssignmentListResponse = {
  total: number;
  items: StaffOwnAssignmentItem[];
};

export type AssignmentActionResponse = {
  assignment_id: string;
  incident_id: string;
  responsible_id: string;
  assignment_status: AssignmentStatus;
  incident_status: IncidentStatus;
  message: string;
};

export type IncidentStatusUpdateResponse = {
  incident_id: string;
  incident_status: IncidentStatus;
  message: string;
};

export type StaffCompleteAssignmentResponse = {
  assignment_id: string;
  incident_id: string;
  assignment_status: AssignmentStatus;
  incident_status: IncidentStatus;
  message: string;
};

export type CampusZone = {
  id: string;
  name: string;
  code: string | null;
  priority: number;
  polygon_geojson: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CampusZoneListResponse = {
  total: number;
  items: CampusZone[];
};

export type IncidentLocationResolveResponse = {
  incident_id: string;
  zone_id: string | null;
  zone_name: string | null;
  location_status: string;
  location_confidence: number | null;
  message: string;
};

export type ReportImageAnalysis = {
  is_appropriate: boolean;
  is_incident: boolean;
  reason: string | null;
  suggested_title: string | null;
  predicted_category: IncidentCategory;
  priority_label: PriorityLevel;
  priority_score: string;
  confidence: string;
  assigned_to: string | null;
  source: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

export class ApiHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(`${status} - ${message}`);
    this.name = "ApiHttpError";
    this.status = status;
  }
}

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
  throw new ApiHttpError(response.status, message);
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

export async function analyzeReportImage(
  token: string | null,
  formData: FormData,
): Promise<ReportImageAnalysis> {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return request<ReportImageAnalysis>("/reports/analyze-image", {
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

export async function getSystemStatus(token: string): Promise<SystemStatusResponse> {
  return request<SystemStatusResponse>("/admin/system-status", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listAdminUsers(
  token: string,
  params?: {
    search?: string;
    role?: UserRole;
    status_filter?: UserStatus;
    limit?: number;
    offset?: number;
  },
): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.role) query.set("role", params.role);
  if (params?.status_filter) query.set("status_filter", params.status_filter);
  query.set("limit", String(params?.limit ?? 100));
  query.set("offset", String(params?.offset ?? 0));

  return request<AdminUserListResponse>(`/admin/users?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createAdminUser(
  token: string,
  payload: {
    campus_id: string;
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    staff_area_name?: string;
    staff_phone_number?: string | null;
    staff_category?: IncidentCategory;
    staff_min_priority?: PriorityLevel;
  },
): Promise<AdminUser> {
  return request<AdminUser>("/admin/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminUser(
  token: string,
  userId: string,
  payload: {
    full_name?: string;
    email?: string;
    role?: UserRole;
    status?: UserStatus;
    password?: string;
    staff_area_name?: string;
    staff_phone_number?: string | null;
    staff_category?: IncidentCategory;
    staff_min_priority?: PriorityLevel;
  },
): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function banAdminUser(token: string, userId: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}/ban`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function unbanAdminUser(token: string, userId: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}/unban`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function listStaff(
  token: string,
  params?: {
    search?: string;
    category?: IncidentCategory;
    active?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<StaffListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.category) query.set("category", params.category);
  if (typeof params?.active === "boolean") query.set("active", String(params.active));
  query.set("limit", String(params?.limit ?? 100));
  query.set("offset", String(params?.offset ?? 0));

  return request<StaffListResponse>(`/admin/staff?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createStaff(
  token: string,
  payload: {
    full_name: string;
    area_name: string;
    email: string;
    phone_number?: string | null;
    category: IncidentCategory;
    min_priority: PriorityLevel;
    is_active: boolean;
  },
): Promise<StaffMember> {
  return request<StaffMember>("/admin/staff", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateStaff(
  token: string,
  staffId: string,
  payload: {
    full_name?: string;
    area_name?: string;
    email?: string;
    phone_number?: string | null;
    category?: IncidentCategory;
    min_priority?: PriorityLevel;
    is_active?: boolean;
  },
): Promise<StaffMember> {
  return request<StaffMember>(`/admin/staff/${staffId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function listStaffAssignments(
  token: string,
  staffId: string,
  params?: {
    status_filter?: AssignmentStatus;
    limit?: number;
    offset?: number;
  },
): Promise<StaffAssignmentListResponse> {
  const query = new URLSearchParams();
  if (params?.status_filter) query.set("status_filter", params.status_filter);
  query.set("limit", String(params?.limit ?? 100));
  query.set("offset", String(params?.offset ?? 0));
  return request<StaffAssignmentListResponse>(
    `/admin/staff/${staffId}/assignments?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function listMyStaffAssignments(
  token: string,
  params?: {
    status_filter?: AssignmentStatus;
    limit?: number;
    offset?: number;
  },
): Promise<StaffOwnAssignmentListResponse> {
  const query = new URLSearchParams();
  if (params?.status_filter) query.set("status_filter", params.status_filter);
  query.set("limit", String(params?.limit ?? 100));
  query.set("offset", String(params?.offset ?? 0));

  return request<StaffOwnAssignmentListResponse>(`/staff/my-assignments?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function completeMyStaffAssignment(
  token: string,
  assignmentId: string,
): Promise<StaffCompleteAssignmentResponse> {
  return request<StaffCompleteAssignmentResponse>(`/staff/assignments/${assignmentId}/complete`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function assignIncidentToStaff(
  token: string,
  incidentId: string,
  payload: {
    responsible_id: string;
    notes?: string;
    notify?: boolean;
  },
): Promise<AssignmentActionResponse> {
  return request<AssignmentActionResponse>(`/admin/incidents/${incidentId}/assign`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAssignmentStatus(
  token: string,
  assignmentId: string,
  payload: {
    status: AssignmentStatus;
    notes?: string;
  },
): Promise<AssignmentActionResponse> {
  return request<AssignmentActionResponse>(`/admin/assignments/${assignmentId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateIncidentStatusAdmin(
  token: string,
  incidentId: string,
  payload: {
    status: IncidentStatus;
  },
): Promise<IncidentStatusUpdateResponse> {
  return request<IncidentStatusUpdateResponse>(`/admin/incidents/${incidentId}/status`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function listCampusZones(
  token: string,
  params?: {
    search?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  },
): Promise<CampusZoneListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (typeof params?.active === "boolean") query.set("active", String(params.active));
  query.set("limit", String(params?.limit ?? 200));
  query.set("offset", String(params?.offset ?? 0));

  return request<CampusZoneListResponse>(`/admin/campus-zones?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createCampusZone(
  token: string,
  payload: {
    name: string;
    code?: string | null;
    priority: number;
    polygon_geojson: Record<string, unknown>;
    is_active: boolean;
  },
): Promise<CampusZone> {
  return request<CampusZone>("/admin/campus-zones", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateCampusZone(
  token: string,
  zoneId: string,
  payload: {
    name?: string;
    code?: string | null;
    priority?: number;
    polygon_geojson?: Record<string, unknown>;
    is_active?: boolean;
  },
): Promise<CampusZone> {
  return request<CampusZone>(`/admin/campus-zones/${zoneId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function resolveIncidentLocationZone(
  token: string,
  incidentId: string,
): Promise<IncidentLocationResolveResponse> {
  return request<IncidentLocationResolveResponse>(`/admin/incidents/${incidentId}/resolve-location`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
