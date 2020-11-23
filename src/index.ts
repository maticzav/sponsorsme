import * as octo from '@octokit/graphql'
import { RequestParameters } from '@octokit/graphql/dist-types/types'

import { Optional, withdefault } from './utils'

/**
 * # sponsorme
 *
 * A lightweight client that lets you check your GitHub sponsors.
 *
 * ## Installation
 *
 * ```bash
 * yarn add sponsorme
 * ```
 *
 * ## Example
 *
 * ```ts
 * let sponsors = Sponsors({ token: "token" })
 *
 * await sponsors.getInfo("maticzav")
 * ```
 *
 * That's it!
 */

/**
 * Creates a Sponsors client that you can use to get sponsors information.
 */
export default class Sponsors {
  // State

  private token: string
  private options: { cache: boolean }

  private cached: { [login: string]: Sponsorship } = {}
  private cursor: Optional<string> = null
  private hasNextPage: boolean = true

  // Initializer

  constructor(opts: SponsorsOptions) {
    this.token = opts.token
    this.options = {
      cache: withdefault(true, opts.cache),
    }
  }

  // Methods

  /**
   * Returns information about the sponsor if it exists.
   *
   * ```ts
   * let sponsors = Sponsors({ token: "token" })
   * await sponsors.getInfo("maticzav")
   * ```
   */
  async getInfo(login: string): Promise<Optional<Sponsorship>> {
    return this.find(login)
  }

  /**
   * Tells whether there exists a sponsor with the given login.
   *
   * ```ts
   * let sponsors = Sponsors({ token: "token" })
   * await sponsors.isSponsor("maticzav")
   * ```
   */
  async isSponsor(login: string): Promise<boolean> {
    return this.find(login).then((user) => user !== null)
  }

  /**
   * Clears the cache.
   *
   * ```ts
   * let sponsors = Sponsors({ token: "token" })
   * sponsors.flush()
   * ```
   */
  flush() {
    this.cached = {}
    this.cursor = null
    this.hasNextPage = true
  }

  // Internal methods

  /**
   * Internal helper that finds a sponsoring for a given login.
   */
  private async find(login: string): Promise<Optional<Sponsorship>> {
    //
    // Check cache and return if present
    if (login in this.cached && this.options.cache) {
      return this.cached[login]
    }

    // Uses global pagination data.

    while (this.hasNextPage) {
      // Construct query
      const params: RequestParameters = {
        cursor: this.cursor,
        headers: {
          authorization: this.token,
        },
      }

      const result = (await octo.graphql(Sponsors.query, params)) as QueryResult

      // Update pagination information.
      const pageInfo = result.viewer.sponsorshipsAsMaintainer.pageInfo
      this.hasNextPage = pageInfo.hasNextPage
      this.cursor = pageInfo.endCursor

      // Process and cache the data.
      const edges = result.viewer.sponsorshipsAsMaintainer.edges
      const sponsorships = edges.map((edge) => {
        const sponsorship = this.sponsorshipFromEdge(edge)

        // Cache the result
        if (sponsorship !== null) {
          this.cached[sponsorship.sponsor.login] = sponsorship
        }

        return sponsorship
      })

      // Check if we've found the sponsor.
      const sponsorship = sponsorships.find((s) => s?.sponsor.login === login)

      // Break early if we've found the sponsorship.
      if (sponsorship !== null && sponsorship !== undefined) return sponsorship
    }

    return null
  }

  /**
   * Converts response's edge to Sponsorship abstract type.
   */
  private sponsorshipFromEdge(edge: QueryResultEdge): Optional<Sponsorship> {
    const sponsor = edge.node.sponsorEntity?.login

    // Returns null if sponsor's login information is missing.
    if (sponsor === null || sponsor === undefined) return null

    // Create a sponsorship from information.
    return {
      id: edge.node.id,
      createdAt: edge.node.createdAt,
      // Sponsor
      sponsor: {
        login: sponsor,
        email:
          edge.node.sponsorEntity?.orgEmail ||
          edge.node.sponsorEntity?.userEmail,
      },
      public: edge.node.privacyLevel === 'PUBLIC',
      // Tier
      tier: {
        id: edge.node.tier.id,
        createdAt: edge.node.tier.createdAt,
        name: edge.node.tier.name,
        description: edge.node.tier.description,
        monthlyPriceInCents: edge.node.tier.monthlyPriceInCents,
      },
    }
  }

  // Query

  private static query = /* graphql */ `
    query Sponsors($cursor: String) {
      # 
      viewer {
        sponsorshipsAsMaintainer(includePrivate: true, first: 50, after: $cursor) {
          # Pagination
          pageInfo {
            hasNextPage
            endCursor
          }
          # Sponsors
          edges {
            cursor
            node {
              # Information about sponsorship
              id
              createdAt
              privacyLevel
              tier {
                id
                name
                createdAt
                description
                monthlyPriceInCents
              }
              # Sponsor details
              sponsorEntity {
                __typename
                ... on User {
                  login
                  userEmail: email
                }
                ... on Organization {
                  login
                  orgEmail: email
                }
              }
            }
          }
          # ---
        }
      }
    }
  `
}

export type SponsorsOptions = {
  /**
   * Whether the client should use internal cache or not.
   */
  cache?: boolean
  /**
   * Viewer's GitHub token used for authentication.
   */
  token: string
}

//
// Types
//

export type Sponsorship = {
  id: string
  createdAt: string
  /**
   * Sponsor information.
   */
  sponsor: SponsorshipSponsor
  /**
   * Whether sponsorship is publicly visible.
   */
  public: boolean
  /**
   * Information about the tier.
   */
  tier: SponsorshipTier
}

export type SponsorshipSponsor = {
  /**
   * Login handle of the sponsor.
   */
  login: string
  /**
   * Sponsor's email if available.
   */
  email?: string
}

export type SponsorshipTier = {
  id: string
  createdAt: string
  /**
   * Information about the tier.
   */
  name: string
  description: string
  /**
   * The amount sponsoree receives each month.
   */
  monthlyPriceInCents: number
}

//
// Internal
//

// QueryResult

type QueryResult = {
  viewer: {
    sponsorshipsAsMaintainer: {
      // Pagination
      pageInfo: {
        hasNextPage: boolean
        endCursor: string
      }
      // Sponsors
      edges: QueryResultEdge[]
    }
  }
}

// QueryResultEdge

type QueryResultEdge = {
  cursor: string
  node: {
    id: string
    createdAt: string
    privacyLevel: 'PUBLIC' | 'PRIVATE'
    tier: {
      id: string
      name: string
      createdAt: string
      description: string
      monthlyPriceInCents: number
    }
    // Sponsor details
    sponsorEntity: null | {
      __typename: string
      login: string
      // Sponsor meta
      userEmail?: string
      orgEmail?: string
    }
  }
}
