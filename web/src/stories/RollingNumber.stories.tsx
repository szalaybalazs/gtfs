import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import RollingNumber from '../components/RollingNumber'

const STEPS = ['11', '10', '9', '4', '3½', '3', '2½', '2', '1½', '1', '59', '58', '57', '0', '-1', '-2']

const meta: Meta = { title: 'Motion / Countdown steps', parameters: { layout: 'padded' } }
export default meta
type Story = StoryObj

export const Steps: Story = {
  render: () => {
    const [i, setI] = useState(3) // Start at "4"
    const [still, setStill] = useState(false)
    const step = (d: number) => setI((x) => Math.min(STEPS.length - 1, Math.max(0, x + d)))
    return (
      <div className="flex max-w-md flex-col gap-6 p-6">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-6">
          <div className="flex items-baseline gap-1.5 text-5xl font-bold">
            <span className="rounded bg-neutral-100">
              <RollingNumber value={STEPS[i]} still={still} />
            </span>
            <span className="text-lg font-medium text-neutral-500">min</span>
          </div>
          <span className="text-sm text-neutral-500">
            step {i + 1} of {STEPS.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => step(-1)} className="rounded-lg border px-4 py-2 font-medium">
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white"
          >
            Next →
          </button>
          <label className="ml-auto flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={still} onChange={(e) => setStill(e.target.checked)} />
            <code>still</code>
          </label>
        </div>
      </div>
    )
  },
}

export const LiveOneSecondCadence: Story = {
  render: () => {
    const [i, setI] = useState(0)
    useEffect(() => {
      const id = window.setInterval(() => setI((x) => (x + 1) % STEPS.length), 1000)
      return () => window.clearInterval(id)
    }, [])
    return (
      <div className="flex max-w-md flex-col gap-3 p-6">
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
          <span className="font-medium">Line 9 · Departure</span>
          <span className="flex items-baseline gap-1 text-2xl font-bold">
            <RollingNumber value={STEPS[i]} />
            <span className="text-xs font-normal text-neutral-500">min</span>
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
          <span className="font-medium">Favorite card suffix</span>
          <span className="text-2xl font-bold">
            <RollingNumber value={i % 2 === 0 ? "2½'" : '10s'} />
          </span>
        </div>
      </div>
    )
  },
}
