import { useState } from 'react'

const DEVICES = [
  { label: 'iPhone 16 Pro', width: 402, height: 874 },
  { label: 'iPhone 16 / 15', width: 393, height: 852 },
  { label: 'iPhone SE', width: 375, height: 667 },
  { label: 'iPhone 16 Pro Max', width: 440, height: 956 },
]

/**
 * Testing aid: the app in an iframe at real iPhone viewport sizes, inside a
 * mock phone frame. Not linked from the menu; open /phone directly.
 */
export default function PhonePreviewPage() {
  const [device, setDevice] = useState(DEVICES[0])
  const [path, setPath] = useState('/')
  const [src, setSrc] = useState('/')
  const [frameKey, setFrameKey] = useState(0)
  const notch = device.height > 700

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-neutral-200 p-6 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <form
        className="flex flex-wrap items-center justify-center gap-2 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          setSrc(path.startsWith('/') ? path : `/${path}`)
          setFrameKey((k) => k + 1)
        }}
      >
        <select
          value={device.label}
          onChange={(e) => setDevice(DEVICES.find((d) => d.label === e.target.value) ?? DEVICES[0])}
          className="rounded-lg border border-neutral-400 bg-white px-2 py-1.5 dark:bg-neutral-800"
        >
          {DEVICES.map((d) => (
            <option key={d.label}>{d.label}</option>
          ))}
        </select>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="w-56 rounded-lg border border-neutral-400 bg-white px-2 py-1.5 font-mono dark:bg-neutral-800"
          aria-label="Path"
        />
        <button type="submit" className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white dark:bg-white dark:text-neutral-900">
          Go
        </button>
        <span className="text-neutral-500">
          {device.width}×{device.height}
        </span>
      </form>

      {/* Phone body: viewport plus a 14px bezel. */}
      <div
        className="relative shrink-0 rounded-[56px] bg-neutral-950 p-[14px] shadow-2xl ring-1 ring-neutral-700"
        style={{ width: device.width + 28, height: device.height + 28 }}
      >
        <iframe
          key={frameKey}
          src={src}
          title="App preview"
          className="h-full w-full rounded-[44px] bg-white"
          style={{ width: device.width, height: device.height }}
        />
        {notch && (
          <div className="pointer-events-none absolute top-[25px] left-1/2 h-[34px] w-[122px] -translate-x-1/2 rounded-full bg-black" />
        )}
        <div className="pointer-events-none absolute bottom-[22px] left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-neutral-400/70" />
      </div>
    </div>
  )
}
