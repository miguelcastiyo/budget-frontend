export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/svg+xml"

const svg = `
<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" rx="40" fill="#ffffff"/>
  <text
    x="50%"
    y="54%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-size="112"
    font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif"
  >
    💰
  </text>
</svg>
`.trim()

export default function AppleIcon() {
  return new Response(svg, {
    headers: {
      "Content-Type": contentType,
    },
  })
}
