// Mulberry32 - a fast, high-quality 32-bit PRNG
// Deterministic: same seed always produces the same sequence
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Generate a random seed (for new games)
export function generateSeed(): string {
  return Math.random().toString(36).substring(2, 8)
}

// Challenge data that gets encoded into a shareable URL
export interface ChallengeData {
  seed: string
  bpm: number
  difficulty: number // 0-1 continuous value
  tuplets: boolean
}

// Encode challenge data to a URL-safe base64 string
export function encodeChallenge(data: ChallengeData): string {
  const json = JSON.stringify({
    s: data.seed,
    b: data.bpm,
    d: Math.round(data.difficulty * 100), // Store as 0-100 int for compactness
    t: data.tuplets ? 1 : 0,
  })
  // Use base64url encoding (URL-safe)
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

// Decode challenge data from a base64 string
export function decodeChallenge(encoded: string): ChallengeData | null {
  try {
    // Restore standard base64
    let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/")
    // Add padding if needed
    while (base64.length % 4) base64 += "="

    const json = atob(base64)
    const parsed = JSON.parse(json)

    return {
      seed: parsed.s,
      bpm: parsed.b,
      difficulty: parsed.d / 100,
      tuplets: parsed.t === 1,
    }
  } catch {
    return null
  }
}

// Convert string seed to numeric seed for PRNG
function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash
}

export class SeededRandom {
  private rng: () => number

  constructor(seed: string) {
    this.rng = mulberry32(hashSeed(seed))
  }

  // Returns a random number between 0 (inclusive) and 1 (exclusive)
  random(): number {
    return this.rng()
  }

  // Returns a random integer between min (inclusive) and max (exclusive)
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min)) + min
  }

  // Returns a random element from an array
  pick<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)]
  }
}
