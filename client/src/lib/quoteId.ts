const easyQuoteCodePattern = /[^A-Z0-9]/g;

export const normalizeQuoteIdForLookup = (value: string) =>
  value.trim().toUpperCase().replace(/\s+/g, '');

export const normalizeEasyQuoteCodeInput = (value: string) =>
  value.toUpperCase().replace(easyQuoteCodePattern, '').slice(0, 6);

export const formatEasyQuoteCode = (value: string) => {
  const normalized = normalizeEasyQuoteCodeInput(value);
  const firstGroup = normalized.slice(0, 3);
  const secondGroup = normalized.slice(3, 6);

  return secondGroup ? `${firstGroup} ${secondGroup}` : firstGroup;
};
