// Keeps the prod API (Render free) awake during shop hours: Render sleeps after 15 idle
// minutes and takes ~1 min to wake. Runs on Cloudflare Workers cron triggers (wrangler.jsonc).
interface Env {
  API_URL: string;
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const started = Date.now();
    const res = await fetch(`${env.API_URL}/health`, { signal: AbortSignal.timeout(90_000) });
    const body = await res.text();
    console.log(`health ${res.status} in ${Date.now() - started} ms: ${body.slice(0, 120)}`);
    if (!res.ok) throw new Error(`health returned ${res.status}`);
  },
};
