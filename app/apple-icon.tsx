import { ImageResponse } from "next/og"
import { renderBrandIconImage } from "@/lib/brand-icon-image"

export const size = {
  width: 180,
  height: 180,
}

export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(renderBrandIconImage(size.width), {
    ...size,
  })
}
