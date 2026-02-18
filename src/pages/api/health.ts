export const prerender = false;

export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      service: 'paper-bear-scraper',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}
