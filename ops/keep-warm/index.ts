// Keeps the prod API (Render free) awake during shop hours: Render sleeps after 15 idle
// minutes and takes ~1 min to wake. Runs on Cloudflare Workers cron triggers (wrangler.jsonc).
// On the hour it also runs the daily loyalty jobs (birthdays…). They are safe to repeat
// (each grant is once per member per period), so hourly runs just retry a missed one.
interface Env {
  API_URL: string;
  /// same value as the API's JOBS_SECRET (wrangler secret put JOBS_SECRET); jobs are skipped without it
  JOBS_SECRET?: string;
}

export default {
  async scheduled(event: { scheduledTime: number }, env: Env): Promise<void> {
    const started = Date.now();
    const res = await fetch(`${env.API_URL}/health`, { signal: AbortSignal.timeout(90_000) });
    const body = await res.text();
    console.log(`health ${res.status} in ${Date.now() - started} ms: ${body.slice(0, 120)}`);
    if (!res.ok) throw new Error(`health returned ${res.status}`);

    if (new Date(event.scheduledTime).getUTCMinutes() !== 0 || !env.JOBS_SECRET) return;
    const jobs = await fetch(`${env.API_URL}/v1/loyalty/jobs/daily`, {
      method: 'POST',
      headers: { 'x-jobs-secret': env.JOBS_SECRET },
      signal: AbortSignal.timeout(60_000),
    });
    console.log(`loyalty jobs ${jobs.status}: ${(await jobs.text()).slice(0, 200)}`);
  },
};
