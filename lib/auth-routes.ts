export const PUBLIC_PATH_PREFIXES = ["/invite/", "/password-reset"] as const

export function isSignInPath(pathname: string): boolean {
  return pathname === "/sign-in"
}

export function isPublicPath(pathname: string): boolean {
  if (isSignInPath(pathname)) {
    return true
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}
