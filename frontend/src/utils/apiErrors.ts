export function getApiErrorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
  return data?.message || data?.error || fallback;
}

export function isSessionError(err: unknown): boolean {
  return getApiErrorStatus(err) === 401;
}

export function isNoSessionError(err: unknown): boolean {
  return getApiErrorStatus(err) === 404;
}

export function isLinkExpiredError(err: unknown): boolean {
  const status = getApiErrorStatus(err);
  return status === 401 || status === 403;
}

export function isForbiddenError(err: unknown): boolean {
  return getApiErrorStatus(err) === 403;
}

export function isConflictError(err: unknown): boolean {
  return getApiErrorStatus(err) === 409;
}

export function isRateLimitedError(err: unknown): boolean {
  return getApiErrorStatus(err) === 429;
}

export function getAdminActionErrorMessage(err: unknown): string {
  const status = getApiErrorStatus(err);
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'One or more candidates are no longer available.';
  if (status === 409) return 'This operation was already processed or conflicts with current state.';
  if (status === 422) return getApiErrorMessage(err, 'This operation is not valid for the current selection.');
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status === 400) return getApiErrorMessage(err, 'Please check your input and try again.');
  if (!status) return 'Network error. Check your connection and try again.';
  return getApiErrorMessage(err);
}
