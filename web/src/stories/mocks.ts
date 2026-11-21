import { fresh, HERE } from './fixtures'

/**
 * Storybook has no API: GraphQL calls never answer (pages keep what the story seeded into the
 * query cache), except alerts, which are answered from the fixture. Location is fixed near Kálvin tér.
 */
export function installMocks() {
  const real = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.includes('graphql')) return real(input, init)
    const body = typeof init?.body === 'string' ? init.body : ''
    if (body.includes('query Alerts'))
      return Promise.resolve(new Response(JSON.stringify({ data: fresh().alerts }), { headers: { 'Content-Type': 'application/json' } }))
    return new Promise<Response>(() => {})
  }
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: PositionCallback) =>
        setTimeout(() => ok({ coords: { latitude: HERE.lat, longitude: HERE.lon, accuracy: 10 } } as GeolocationPosition), 0),
    },
  })
}
