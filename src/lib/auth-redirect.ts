export const AUTH_MODAL_PARAM = "auth"
export const RETURN_TO_PARAM = "returnTo"

export function getReturnToFromLocation(location: {
  pathname: string
  search: string
  hash: string
}): string {
  return `${location.pathname}${location.search}${location.hash}`
}

export function normalizeReturnTo(value?: string | null): string {
  if (!value) return "/"
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value
  }
  return "/"
}

export function buildAuthSearch(currentSearch: string, returnTo: string): string {
  const params = new URLSearchParams(currentSearch)
  params.set(AUTH_MODAL_PARAM, "1")
  params.set(RETURN_TO_PARAM, returnTo)
  const next = params.toString()
  return next ? `?${next}` : ""
}

export function stripAuthSearch(currentSearch: string): string {
  const params = new URLSearchParams(currentSearch)
  params.delete(AUTH_MODAL_PARAM)
  params.delete(RETURN_TO_PARAM)
  const next = params.toString()
  return next ? `?${next}` : ""
}
