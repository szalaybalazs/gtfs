import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import { initLocale } from '../src/lib/i18n'
import { applyTheme } from '../src/lib/theme'
import { installMocks } from '../src/stories/mocks'

applyTheme()
initLocale()
installMocks()

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: false },
    viewport: {
      options: {
        phone: { name: 'Phone 375x812', styles: { width: '375px', height: '812px' }, type: 'mobile' },
        tablet: { name: 'Tablet 768x1024', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
      },
    },
  },
  initialGlobals: { viewport: { value: 'phone', isRotated: false } },
}
export default preview
