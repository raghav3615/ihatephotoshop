import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const runtime = 'nodejs';

export async function GET() {
  const source = await readFile(join(process.cwd(), 'index.html'), 'utf8');
  const body = source.match(/<body>([\s\S]*)<\/body>/i)?.[1] ?? '';
  return new Response(body.replace(/<script src="app\.js"><\/script>/, ''), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
