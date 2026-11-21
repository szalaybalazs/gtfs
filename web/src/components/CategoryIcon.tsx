import { metroColorIcon, type Category } from '../lib/categories'

/** A BKK pictogram tinted with its category colour (the SVG is used as a mask); metro is the full-colour gradient. */
export default function CategoryIcon({ category, className = 'h-6 w-6', color }: { category: Category; className?: string; color?: string }) {
  // Metro, unless a flat colour is asked for: the full-colour gradient version
  if (category.key === 'metro' && !color) {
    return <span aria-hidden className={`inline-block shrink-0 bg-contain bg-center bg-no-repeat ${className}`} style={{ backgroundImage: `url("${metroColorIcon}")` }} />
  }
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
