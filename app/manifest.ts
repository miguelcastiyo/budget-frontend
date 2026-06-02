import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Budget",
    short_name: "Budget",
    description: "Track your spending with a clean, minimal budgeting app",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1f232b",
    theme_color: "#1f232b",
    icons: [
      {
        src: "/brand-icon.png",
        sizes: "350x350",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand-icon.png",
        sizes: "350x350",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
