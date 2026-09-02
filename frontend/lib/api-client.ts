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
  assignment_count: number;
  assigned_to: string[];
};

export type IncidentListResponse = {
  total: number;
  items: IncidentListItem[];
};

export type StudentFeedItem = {
  id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  description: string;
  created_at: string;
  location_zone_name: string | null;
  has_image: boolean;
  community_consent: boolean;
  is_community_visible: boolean;
};

export type CommunityFeedItem = {
  id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  description: string;
  created_at: string;
  location_zone_name: string | null;
  has_image: boolean;
  reaction_count: number;
  reacted_by_me: boolean;
  is_own_report: boolean;
};

export type StudentFeedResponse = {
  total: number;
  items: StudentFeedItem[];
};

export type CommunityFeedResponse = {
  total: number;
  items: CommunityFeedItem[];
};

export type ReactionState = {
  reaction_count: number;
  reacted_by_me: boolean;
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

export type ModerationDecisionInfo = {
  actor_label: string;
  published: boolean;
  reason: string | null;
  ai_verdict: string | null;
  created_at: string;
};

export type ModerationQueueItem = {
  incident_id: string;
  category: IncidentCategory;
  status: IncidentStatus;
  description: string;
  created_at: string;
  location_zone_name: string | null;
  is_community_visible: boolean;
  evidence_id: string | null;
  moderation_state: string;
  ai_evaluated: boolean;
  ai_is_appropriate: boolean | null;
  ai_is_incident: boolean | null;
  ai_reason: string | null;
  last_decision: ModerationDecisionInfo | null;
};

export type ModerationQueueResponse = {
  total: number;
  ai_moderation_enabled: boolean;
  ai_provider_failing: boolean;
  items: ModerationQueueItem[];
};

export type SessionResponse = {
  message: string;
  role: UserRole;
  campus_id: string;
  csrf_token: string;
};

export type Profile = {
  id: string;
  campus_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  other_sessions: number;
};

export type CurrentUser = {
  id: string;
  campus_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  csrf_token?: string | null;
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

export type AIProviderStatus = {
  api_key_configured: boolean;
  model: string;
  state: string;
  fallback_count_24h: number;
  quota_exhausted_detected: boolean;
  latest_fallback_reason: string | null;
  latest_source: string | null;
  failed_classifications_24h: number;
  latest_failure_reason: string | null;
};

export type SystemStatusResponse = {
  api_ok: boolean;
  overdue_assignments: number;
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
  ai: AIProviderStatus;
  notes: string[];
};

type SystemStatusWireResponse = Omit<SystemStatusResponse, "ai"> & {
  ai?: AIProviderStatus;
  // Compatibility with a backend process that has not been restarted yet.
  gemini?: AIProviderStatus;
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

/**
 * Testigo CSRF de la sesion actual.
 *
 * Se guarda en memoria porque `document.cookie` no puede leer la cookie que
 * pone la API: en produccion el frontend vive en un dominio y la API en otro,
 * y una pagina solo ve las cookies de su propio dominio. Sin esto, toda
 * peticion que modifique datos se rechaza con 403.
 *
 * En memoria y no en `localStorage`: se pierde al recargar --y se recupera
 * pidiendo `/auth/me`--, pero no queda escrito en el disco del visitante.
 */
let csrfEnMemoria: string | null = null;

export function recordarCsrf(token: string | null | undefined): void {
  csrfEnMemoria = token ?? null;
}

function tomarCsrf(): string | null {
  if (csrfEnMemoria) return csrfEnMemoria;
  // Cuando comparten dominio --desarrollo local-- la cookie si es legible, y
  // sirve de respaldo si aun no se ha pedido /auth/me.
  const desdeCookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("campus_csrf="))
    ?.split("=", 2)[1];
  return desdeCookie ? decodeURIComponent(desdeCookie) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // All authenticated traffic uses the HttpOnly session cookie. Kept as defense
  // in depth so no caller can reintroduce bearer credentials.
  headers.delete("Authorization");
  if (!["GET", "HEAD", "OPTIONS"].includes((init?.method ?? "GET").toUpperCase())) {
    const csrf = tomarCsrf();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    return parseError(response);
  }
  return (await response.json()) as T;
}

export async function login(campusId: string, password: string): Promise<SessionResponse> {
  const session = await request<SessionResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campus_id: campusId, password }),
  });
  recordarCsrf(session.csrf_token);
  return session;
}

export async function registerUser(payload: PublicRegisterPayload): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/verify-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(
  token: string,
  password: string,
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password-reset/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await request<CurrentUser>("/auth/me");
  // Recupera el testigo tras recargar la pagina, que es cuando se pierde el
  // que estaba en memoria.
  recordarCsrf(user.csrf_token);
  return user;
}

export async function getProfile(): Promise<Profile> {
  return request<Profile>("/auth/profile");
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function revokeOtherSessions(): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/sessions/revoke-others", { method: "POST" });
}

export async function logout(): Promise<{ message: string }> {
  try {
    return await request<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    recordarCsrf(null);
  }
}

export async function createReport(
  formData: FormData,
  turnstileToken?: string | null,
): Promise<{
  incident_id: string;
  status: IncidentStatus;
  created_at: string;
  ai_status: string;
}> {
  const headers: Record<string, string> = {};
  if (turnstileToken) headers["X-Turnstile-Token"] = turnstileToken;

  return request("/reports", {
    method: "POST",
    headers,
    body: formData,
  });
}

export async function listIncidents(
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

  return request<IncidentListResponse>(`/incidents?${query.toString()}`);
}

type FeedFilters = {
  status_filter?: IncidentStatus;
  category?: IncidentCategory;
  limit?: number;
  offset?: number;
};

function feedQuery(params: FeedFilters): string {
  const query = new URLSearchParams();
  if (params.status_filter) query.set("status_filter", params.status_filter);
  if (params.category) query.set("category", params.category);
  query.set("limit", String(params.limit ?? 12));
  query.set("offset", String(params.offset ?? 0));
  return query.toString();
}

export async function listMyIncidentFeed(params: FeedFilters = {}): Promise<StudentFeedResponse> {
  return request<StudentFeedResponse>(`/incidents/mine/feed?${feedQuery(params)}`);
}

export async function listAdminIncidentFeed(params: FeedFilters = {}): Promise<StudentFeedResponse> {
  return request<StudentFeedResponse>(`/incidents/admin/feed?${feedQuery(params)}`);
}

export async function listCommunityFeed(params: FeedFilters = {}): Promise<CommunityFeedResponse> {
  return request<CommunityFeedResponse>(`/incidents/community?${feedQuery(params)}`);
}

async function getPrivateImageObjectUrl(path: string): Promise<string> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (!response.ok) return parseError(response);
  return URL.createObjectURL(await response.blob());
}

export async function getMyIncidentFeedImageObjectUrl(incidentId: string): Promise<string> {
  return getPrivateImageObjectUrl(`/incidents/mine/${incidentId}/image`);
}

export async function getAdminIncidentFeedImageObjectUrl(incidentId: string): Promise<string> {
  return getPrivateImageObjectUrl(`/incidents/admin/${incidentId}/image`);
}

export async function getCommunityFeedImageObjectUrl(incidentId: string): Promise<string> {
  return getPrivateImageObjectUrl(`/incidents/community/${incidentId}/image`);
}

export async function addCommunityReaction(incidentId: string): Promise<ReactionState> {
  return request<ReactionState>(`/incidents/community/${incidentId}/reaction`, { method: "POST" });
}

export async function removeCommunityReaction(incidentId: string): Promise<ReactionState> {
  return request<ReactionState>(`/incidents/community/${incidentId}/reaction`, { method: "DELETE" });
}

export async function revokeCommunityConsent(incidentId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/incidents/${incidentId}/community-consent`, {
    method: "PATCH",
  });
}

export async function getIncidentDetail(incidentId: string): Promise<IncidentDetail> {
  return request<IncidentDetail>(`/incidents/${incidentId}`);
}

export async function getEvidenceObjectUrl(
  incidentId: string,
  evidenceId: string,
): Promise<string> {
  const response = await fetch(
    `${API_BASE}/incidents/${incidentId}/evidences/${evidenceId}`,
    {
      credentials: "include",
    },
  );
  if (!response.ok) {
    return parseError(response);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function getSystemStatus(): Promise<SystemStatusResponse> {
  const payload = await request<SystemStatusWireResponse>("/admin/system-status");
  const ai = payload.ai ?? payload.gemini;
  if (!ai) {
    throw new Error("La API devolvió un estado IA incompleto; reinicia el backend.");
  }
  return { ...payload, ai };
}

export async function listAdminUsers(
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

  return request<AdminUserListResponse>(`/admin/users?${query.toString()}`);
}

export async function createAdminUser(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAdminUser(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function banAdminUser(userId: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}/ban`, {
    method: "POST",
  });
}

export async function unbanAdminUser(userId: string): Promise<AdminUser> {
  return request<AdminUser>(`/admin/users/${userId}/unban`, {
    method: "POST",
  });
}

export async function listStaff(
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

  return request<StaffListResponse>(`/admin/staff?${query.toString()}`);
}

export async function createStaff(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateStaff(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function listStaffAssignments(
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
    },
  );
}

export async function listMyStaffAssignments(
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

  return request<StaffOwnAssignmentListResponse>(`/staff/my-assignments?${query.toString()}`);
}

export async function completeMyStaffAssignment(
  assignmentId: string,
): Promise<StaffCompleteAssignmentResponse> {
  return request<StaffCompleteAssignmentResponse>(`/staff/assignments/${assignmentId}/complete`, {
    method: "POST",
  });
}

export async function assignIncidentToStaff(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateAssignmentStatus(
  assignmentId: string,
  payload: {
    status: AssignmentStatus;
    notes?: string;
  },
): Promise<AssignmentActionResponse> {
  return request<AssignmentActionResponse>(`/admin/assignments/${assignmentId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateIncidentStatusAdmin(
  incidentId: string,
  payload: {
    status: IncidentStatus;
  },
): Promise<IncidentStatusUpdateResponse> {
  return request<IncidentStatusUpdateResponse>(`/admin/incidents/${incidentId}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function listCampusZones(
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

  return request<CampusZoneListResponse>(`/admin/campus-zones?${query.toString()}`);
}

export async function createCampusZone(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function updateCampusZone(
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function resolveIncidentLocationZone(
  incidentId: string,
): Promise<IncidentLocationResolveResponse> {
  return request<IncidentLocationResolveResponse>(`/admin/incidents/${incidentId}/resolve-location`, {
    method: "POST",
  });
}

export async function listModerationQueue(params?: {
  include_published?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ModerationQueueResponse> {
  const query = new URLSearchParams();
  if (params?.include_published) query.set("include_published", "true");
  query.set("limit", String(params?.limit ?? 100));
  query.set("offset", String(params?.offset ?? 0));
  return request<ModerationQueueResponse>(`/admin/moderation-queue?${query.toString()}`);
}

export async function setCommunityVisibility(
  incidentId: string,
  payload: { visible: boolean; reason?: string },
): Promise<{
  incident_id: string;
  is_community_visible: boolean;
  moderation_state: string;
  message: string;
}> {
  return request(`/admin/incidents/${incidentId}/community-visibility`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
