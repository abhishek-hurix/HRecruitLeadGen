export function getApiErrorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (err as { response?: { data?: { message?: string } } })?.response?.data;
  return data?.message || fallback;
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
