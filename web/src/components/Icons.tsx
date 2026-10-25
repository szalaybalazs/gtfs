import type { SVGProps } from 'react'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const

export const LocationIcon = ({ filled, ...props }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base} {...props}>
    <path d="M3 11 21 3l-8 18-2-8-8-2Z" fill={filled ? 'currentColor' : 'none'} />
  </svg>
)

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

export const ChevronIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const UpDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
  </svg>
)

export const RefreshIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

export const WheelchairIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="4" r="1.5" />
    <path d="M12 7v6h5l2 5" />
    <path d="M8.5 10.5a5.5 5.5 0 1 0 7.2 7.7" />
  </svg>
)

export const BikeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>
    <circle cx="5.5" cy="17.5" r="3.5" />
    <circle cx="18.5" cy="17.5" r="3.5" />
    <path d="M15 6h2l3 11.5M5.5 17.5 9 10h7l-4 7.5H5.5M9 10 8 7H6" />
  </svg>
)
