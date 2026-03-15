interface PhoneUserShape {
  primaryPhoneNumber?: {
    phoneNumber?: string | null;
  } | null;
  unsafeMetadata?: unknown;
}

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
};

const normalizePhone = (value: unknown) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

export const getAccountPhone = (user: PhoneUserShape | null | undefined) => {
  const primaryPhone = normalizePhone(user?.primaryPhoneNumber?.phoneNumber);
  if (primaryPhone.length >= 7) {
    return primaryPhone;
  }

  const unsafeMetadata = toRecord(user?.unsafeMetadata);
  const profileMetadata = toRecord(unsafeMetadata.autoscapeProfile);
  const customPhone = normalizePhone(profileMetadata.phone);
  return customPhone.length >= 7 ? customPhone : '';
};

export const hasRequiredPhone = (user: PhoneUserShape | null | undefined) => getAccountPhone(user).length >= 7;
