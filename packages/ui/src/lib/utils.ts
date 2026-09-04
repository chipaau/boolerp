import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge only knows Tailwind's stock font sizes, so it reads our type-scale classes
 * (`text-caption`, `text-ui-sm`, …) as text *colours* and drops one when a component combines a
 * size with a colour in `cn()`. Register the scale so sizes and colours merge independently.
 */
const TYPE_SCALE = [
  "display", "display-sm", "h1", "h2", "h3", "title", "prose", "ui", "caption", "label", "overline",
  "micro", "fine", "meta", "compact", "ui-sm", "ui-lg", "heading-sm",
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TYPE_SCALE }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
