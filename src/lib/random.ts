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
