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
    background_color: "#0F1113",
    theme_color: "#0F1113",
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
