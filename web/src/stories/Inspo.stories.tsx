import type { Meta, StoryObj } from '@storybook/react-vite'
import { Providers } from './harness'
import HomeInspo from './inspo/HomeInspo'
import StationInspo from './inspo/StationInspo'

/** Design variant: soft pastels, big greeting, tiles, floating dark nav. Story-only, uses the fixtures. */
const meta: Meta = { title: 'Inspo (pastel variant)', parameters: { layout: 'fullscreen' } }
export default meta
type Story = StoryObj

export const Home: Story = { render: () => <Providers><HomeInspo /></Providers> }
export const Station: Story = { render: () => <Providers><StationInspo /></Providers> }
