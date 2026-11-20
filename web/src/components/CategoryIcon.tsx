import type { Category } from '../lib/categories'

/** A BKK pictogram tinted with its category colour (the SVG is used as a mask). */
export default function CategoryIcon({ category, className = 'h-6 w-6', color }: { category: Category; className?: string; color?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      style={{
        backgroundColor: color ?? category.color,
        maskImage: `url("${category.icon}")`,
        WebkitMaskImage: `url("${category.icon}")`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}
