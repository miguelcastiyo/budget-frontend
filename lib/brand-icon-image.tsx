import type { ReactNode } from "react"

export function renderBrandIconImage(size: number): ReactNode {
  const radius = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.48)

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1f232b",
        borderRadius: radius,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: 700,
          color: "#fbfbfb",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          lineHeight: 1,
          marginTop: -Math.round(size * 0.02),
        }}
      >
        B
      </div>
    </div>
  )
}
