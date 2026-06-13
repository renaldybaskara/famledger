module.exports = {
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
  Link: 'Link',
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}
