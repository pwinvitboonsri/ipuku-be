// Remembers ids seen in the last `ttlMs`, so a redelivered LINE webhook event
// (same webhookEventId) is handled once. In memory: a restart forgets, which is
// fine for the PoC; the member/points tables will enforce uniqueness themselves.
export class RecentIds {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly ttlMs: number,
    private readonly max = 5000,
  ) {}

  // true the first time an id is seen inside the window
  firstSeen(id: string, now = Date.now()): boolean {
    this.prune(now);
    if (this.seen.has(id)) return false;

    this.seen.set(id, now);
    // Map keeps insertion order, so the oldest entry goes first
    if (this.seen.size > this.max) {
      this.seen.delete(this.seen.keys().next().value!);
    }
    return true;
  }

  private prune(now: number) {
    for (const [id, at] of this.seen) {
      if (now - at < this.ttlMs) break;
      this.seen.delete(id);
    }
  }
}
