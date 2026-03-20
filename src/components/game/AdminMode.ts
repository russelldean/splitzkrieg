export function isAdminMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check URL parameter: ?mode=commissioner
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'commissioner') return true;

  // Check for admin-token cookie (existing admin auth from Phase 8)
  // Just check cookie existence, don't verify JWT client-side
  const cookies = document.cookie.split(';');
  const hasAdminToken = cookies.some(c => c.trim().startsWith('admin-token='));
  return hasAdminToken;
}
