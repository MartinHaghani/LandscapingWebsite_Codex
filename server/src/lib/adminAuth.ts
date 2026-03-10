import type http from 'node:http';
import type { AdminRole } from './dataStore.js';

export interface AdminIdentity {
  userId: string;
  role: AdminRole;
}

const roleOrder: AdminRole[] = ['MARKETING', 'REVIEWER', 'ADMIN', 'OWNER'];
const roleSet = new Set<AdminRole>(roleOrder);

const normalizeRole = (value: string | undefined | null): AdminRole | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase() as AdminRole;
  return roleSet.has(normalized) ? normalized : null;
};

export const capabilityMatrix = {
  VIEW_PII_FULL: ['OWNER', 'ADMIN', 'REVIEWER'] as AdminRole[],
  VIEW_ATTRIBUTION: ['OWNER', 'ADMIN', 'REVIEWER', 'MARKETING'] as AdminRole[],
  EXPORT_PII_FULL: ['OWNER', 'ADMIN', 'REVIEWER'] as AdminRole[],
  EXPORT_MARKETING_SAFE: ['OWNER', 'ADMIN', 'REVIEWER', 'MARKETING'] as AdminRole[]
};

export const hasCapability = (role: AdminRole, capability: keyof typeof capabilityMatrix) =>
  capabilityMatrix[capability].includes(role);

const parseBearerToken = (req: http.IncomingMessage) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim();
};

const parseDevIdentityFromHeaders = (req: http.IncomingMessage): AdminIdentity | null => {
  const role = normalizeRole(
    (req.headers['x-admin-role'] as string | undefined) ?? (req.headers['x-clerk-role'] as string | undefined)
  );

  if (!role) {
    return null;
  }

  const userId =
    (req.headers['x-admin-user-id'] as string | undefined)?.trim() ||
    (req.headers['x-clerk-user-id'] as string | undefined)?.trim() ||
    `dev-${role.toLowerCase()}`;

  return {
    userId,
    role
  };
};

export const resolveAdminIdentity = (req: http.IncomingMessage): AdminIdentity | null => {
  const staticToken = process.env.ADMIN_API_TOKEN?.trim();
  const bearerToken = parseBearerToken(req);

  if (staticToken && bearerToken && bearerToken === staticToken) {
    return {
      userId: 'static-admin-token',
      role: 'OWNER'
    };
  }

  const allowHeaderAuth = process.env.NODE_ENV !== 'production' || process.env.ALLOW_INSECURE_ADMIN_HEADERS === 'true';

  if (allowHeaderAuth) {
    return parseDevIdentityFromHeaders(req);
  }

  return null;
};
