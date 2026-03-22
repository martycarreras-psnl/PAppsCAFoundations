// wizard/lib/validate.mjs — Shared validation helpers

export function isValidPrefix(v) {
  return /^[a-z]{2,8}$/.test(v);
}

export function isValidUUID(v) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
}

export function isValidDataverseUrl(v) {
  return /^https:\/\/.*\.crm[0-9]*\.dynamics\.com\/?$/.test(v);
}

export function isValidChoicePrefix(v) {
  return /^[0-9]{4,6}$/.test(v);
}
