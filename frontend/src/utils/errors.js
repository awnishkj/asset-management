export function sanitizeServerMessage(msg) {
  if (!msg) return '';
  // Hide internal reference errors like "previewUrl is not defined"
  if (/\b\w+ is not defined\b/.test(msg)) return 'An internal server error occurred (check server logs)';
  // Generic fallback
  return msg;
}
