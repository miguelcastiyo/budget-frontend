const backendOrigin = process.env.BACKEND_ORIGIN || "http://localhost:8000"
let localBackend = false
try { const url = new URL(backendOrigin); localBackend = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) } catch { /* Invalid backend origins cannot enable pending writes. */ }
const pendingDevelopment = process.env.NODE_ENV === "development" && process.env.BUDGET_ENABLE_PENDING_DEV === "1" && localBackend

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: { NEXT_PUBLIC_PENDING_DEVELOPMENT: pendingDevelopment ? "1" : "0" },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    unoptimized: true,
  },
  async rewrites() {

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'none'; manifest-src 'self'" },
        ],
      },
    ]
  },
}

export default nextConfig
