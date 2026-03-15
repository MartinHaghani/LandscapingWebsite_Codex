import type http from 'node:http';
import { createClerkClient } from '@clerk/backend';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AdminRole } from './dataStore.js';

export interface CustomerIdentity {
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export interface AdminIdentity {
  userId: string;
  role: AdminRole;
  orgId: string;
}

const roleOrder: AdminRole[] = ['MARKETING', 'REVIEWER', 'ADMIN', 'OWNER'];
const roleSet = new Set<AdminRole>(roleOrder);
const accountAddressMetadataKey = 'autoscapeProfile';
const accountAddressHistoryLimit = 10;

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const parseBearerToken = (req: http.IncomingMessage) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

const normalizeRole = (value: string | undefined | null): AdminRole | null => {
  if (!value) {
    return null;
  }

  const raw = value.trim().toLowerCase();
  const normalized =
    raw === 'owner' || raw === 'org:owner'
      ? 'OWNER'
      : raw === 'admin' || raw === 'org:admin'
        ? 'ADMIN'
        : raw === 'reviewer' || raw === 'org:reviewer'
          ? 'REVIEWER'
          : raw === 'marketing' || raw === 'org:marketing'
            ? 'MARKETING'
            : null;

  if (!normalized) {
    return null;
  }

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

const readStringClaim = (payload: JWTPayload, key: string) => {
  const value = payload[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toMetadataRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const normalizeAddress = (value: string) => value.trim().replace(/\s+/g, ' ');

const dedupeAddresses = (items: string[]) => {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const item of items) {
    const normalized = normalizeAddress(item);
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
};

const readAddressHistory = (metadata: Record<string, unknown>) => {
  const raw = metadata.addressHistory;
  if (!Array.isArray(raw)) {
    return [] as string[];
  }

  return dedupeAddresses(raw.filter((entry): entry is string => typeof entry === 'string'));
};

const getTokenIssuer = () => {
  const issuer = process.env.CLERK_JWT_ISSUER?.trim();
  if (!issuer) {
    throw new Error('AUTH_CONFIG_ERROR');
  }

  return issuer.replace(/\/$/, '');
};

const getJwksUrl = () => {
  const fromEnv = process.env.CLERK_JWKS_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  return `${getTokenIssuer()}/.well-known/jwks.json`;
};

const getJwks = () => {
  const url = getJwksUrl();
  const cached = jwksCache.get(url);
  if (cached) {
    return cached;
  }

  const next = createRemoteJWKSet(new URL(url));
  jwksCache.set(url, next);
  return next;
};

const verifyToken = async (token: string) => {
  const issuer = getTokenIssuer();
  const { payload } = await jwtVerify(token, getJwks(), {
    issuer
  });

  return payload;
};

const getClerkClient = () => {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim();
  if (!secretKey) {
    return null;
  }

  return createClerkClient({
    secretKey
  });
};

const resolveAdminMembership = async (userId: string, requiredOrgId: string) => {
  const clerk = getClerkClient();
  if (!clerk) {
    return null;
  }

  const memberships = await clerk.users.getOrganizationMembershipList({
    userId,
    limit: 100
  });

  const current = memberships.data.find((membership) => membership.organization.id === requiredOrgId);
  if (!current) {
    return null;
  }

  const role = normalizeRole(current.role);
  if (!role) {
    return null;
  }

  return {
    orgId: current.organization.id,
    role
  };
};

const readEmailFromTokenPayload = (payload: JWTPayload) =>
  readStringClaim(payload, 'email') ??
  readStringClaim(payload, 'email_address') ??
  readStringClaim(payload, 'primary_email_address');

const readNameFromTokenPayload = (payload: JWTPayload) => {
  const fullName = readStringClaim(payload, 'name');
  if (fullName) {
    return fullName;
  }

  const given = readStringClaim(payload, 'given_name');
  const family = readStringClaim(payload, 'family_name');
  const combined = [given, family].filter((value) => !!value).join(' ').trim();
  return combined.length > 0 ? combined : null;
};

const readPhoneFromTokenPayload = (payload: JWTPayload) =>
  readStringClaim(payload, 'phone_number') ??
  readStringClaim(payload, 'phone') ??
  readStringClaim(payload, 'primary_phone_number');

const readPhoneFromUserMetadata = (metadata: unknown) => {
  const metadataRecord = toMetadataRecord(metadata);
  const profileMetadata = toMetadataRecord(metadataRecord[accountAddressMetadataKey]);
  const value = profileMetadata.phone;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const loadUserProfile = async (userId: string) => {
  const clerk = getClerkClient();
  if (!clerk) {
    return null;
  }

  const user = await clerk.users.getUser(userId);
  const email =
    user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    null;

  const name = [user.firstName, user.lastName].filter((value) => !!value).join(' ').trim() || user.username || null;
  const metadataPhone = readPhoneFromUserMetadata(user.unsafeMetadata);
  const phone =
    user.phoneNumbers.find((entry) => entry.id === user.primaryPhoneNumberId)?.phoneNumber ??
    user.phoneNumbers[0]?.phoneNumber ??
    metadataPhone ??
    null;

  return {
    email,
    name,
    phone
  };
};

const readUserId = (payload: JWTPayload) => {
  const userId = readStringClaim(payload, 'sub');
  if (!userId) {
    throw new Error('AUTH_REQUIRED');
  }

  return userId;
};

const readOrgId = (payload: JWTPayload) => readStringClaim(payload, 'org_id');
const readOrgRole = (payload: JWTPayload) => readStringClaim(payload, 'org_role');

const toAuthErrorCode = (error: unknown): string => {
  if (error instanceof Error && typeof error.message === 'string' && error.message.length > 0) {
    return error.message;
  }

  return 'AUTH_REQUIRED';
};

export const resolveCustomerIdentity = async (
  req: http.IncomingMessage
): Promise<CustomerIdentity | null> => {
  const token = parseBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token);
    const userId = readUserId(payload);

    let email = readEmailFromTokenPayload(payload);
    let name = readNameFromTokenPayload(payload);
    let phone = readPhoneFromTokenPayload(payload);

    if (!email || !name || !phone) {
      const profile = await loadUserProfile(userId);
      email = email ?? profile?.email ?? null;
      name = name ?? profile?.name ?? null;
      phone = phone ?? profile?.phone ?? null;
    }

    if (!email) {
      throw new Error('AUTH_PROFILE_INCOMPLETE');
    }

    return {
      userId,
      email,
      name,
      phone
    };
  } catch (error) {
    const code = toAuthErrorCode(error);
    if (code === 'AUTH_CONFIG_ERROR' || code === 'AUTH_PROFILE_INCOMPLETE') {
      throw new Error(code);
    }

    throw new Error('AUTH_REQUIRED');
  }
};

export const recordCustomerAddress = async (input: { userId: string; addressText: string }) => {
  const clerk = getClerkClient();
  if (!clerk) {
    return;
  }

  const normalizedAddress = normalizeAddress(input.addressText);
  if (!normalizedAddress) {
    return;
  }

  const user = await clerk.users.getUser(input.userId);
  const privateMetadata = toMetadataRecord(user.privateMetadata);
  const profileMetadata = toMetadataRecord(privateMetadata[accountAddressMetadataKey]);
  const currentHistory = readAddressHistory(profileMetadata);
  const nextHistory = dedupeAddresses([normalizedAddress, ...currentHistory]).slice(0, accountAddressHistoryLimit);
  const currentDefault = typeof profileMetadata.defaultAddress === 'string' ? normalizeAddress(profileMetadata.defaultAddress) : '';

  if (currentDefault === normalizedAddress && currentHistory.length === nextHistory.length) {
    const sameHistory = currentHistory.every((item, index) => item === nextHistory[index]);
    if (sameHistory) {
      return;
    }
  }

  await clerk.users.updateUserMetadata(input.userId, {
    privateMetadata: {
      ...privateMetadata,
      [accountAddressMetadataKey]: {
        ...profileMetadata,
        defaultAddress: normalizedAddress,
        addressHistory: nextHistory
      }
    }
  });
};

export const resolveAdminIdentity = async (req: http.IncomingMessage): Promise<AdminIdentity | null> => {
  const token = parseBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token);
    const userId = readUserId(payload);
    const orgId = readOrgId(payload);
    const orgRoleClaim = readOrgRole(payload);
    const role = normalizeRole(orgRoleClaim);
    const requiredOrgId = process.env.CLERK_ADMIN_ORG_ID?.trim();

    if (!requiredOrgId) {
      throw new Error('AUTH_CONFIG_ERROR');
    }

    if (orgId && orgId === requiredOrgId && role) {
      return {
        userId,
        role,
        orgId
      };
    }

    const membership = await resolveAdminMembership(userId, requiredOrgId);
    if (!membership) {
      throw new Error('AUTH_FORBIDDEN');
    }

    return {
      userId,
      role: membership.role,
      orgId: membership.orgId
    };
  } catch (error) {
    const code = toAuthErrorCode(error);
    if (code === 'AUTH_FORBIDDEN' || code === 'AUTH_CONFIG_ERROR') {
      throw new Error(code);
    }

    throw new Error('AUTH_REQUIRED');
  }
};
