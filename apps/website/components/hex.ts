import { HEX_PATH, HEX_VIEWBOX } from '@workspace/ui/components/hexagon'

/** The brand hexagon as a CSS mask, stretched to the box it masks (like the dashboard's app tiles). */
export const HEX_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${HEX_VIEWBOX}' preserveAspectRatio='none'><path d='${HEX_PATH}'/></svg>`,
)}") center / 100% 100% no-repeat`
