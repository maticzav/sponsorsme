import Sponsors, { Sponsorship } from '../src'

// Configuration

const TOKEN = process.env.GH_TOKEN!

// Tests

describe('client', () => {
  let client: Sponsors

  // Set up

  beforeAll(() => {
    client = new Sponsors({ token: TOKEN })
  })

  // Tests

  test('find sponsor information', async () => {
    const sponsor = await client.getInfo('jure')

    expect(sponsor?.sponsor.login).toBe('jure')
  })

  test('tell whether sponsor exists', async () => {
    expect(await client.isSponsor('jure')).toBe(true)
    expect(await client.isSponsor('noone')).toBe(false)
  })

  test('flush cache', () => {
    expect(() => {
      client.flush()
    }).not.toThrow()
  })
})
