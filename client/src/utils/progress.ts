// floor, not round: the bar only reaches 100 when everything is removed (this also covers total 0).
export function percentOf(removed: number, total: number): number {
  if (removed >= total) return 100
  return Math.floor(removed / total * 100)
}
