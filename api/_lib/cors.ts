// CORS helper for Vercel serverless functions
// Uses generic types to avoid @vercel/node import issues

export function cors(req: { method?: string }, res: { setHeader: (k: string, v: string) => void; status: (code: number) => { end: () => void } }): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Payment, stripe-signature');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
