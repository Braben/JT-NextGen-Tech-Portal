export function validateApiResponse(response) {
  // Static-host SPA rewrites can return index.html with a successful status.
  // Reject it at the boundary before it reaches application state.
  const contentType = response.headers?.['content-type'] || '';
  if (contentType.includes('text/html') ||
      (typeof response.data === 'string' && /^\s*(<!doctype html|<html)/i.test(response.data))) {
    throw new Error('The API returned a web page instead of data. Check the deployed API URL and routing.');
  }
  return response;
}

export function requireList(data) {
  if (!Array.isArray(data)) throw new Error('The server returned an invalid list response.');
  return data;
}
