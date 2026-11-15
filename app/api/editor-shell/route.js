import { EDITOR_SHELL_HTML } from '../../editor-shell-content.js';

export const runtime = 'nodejs';

export async function GET() {
  return new Response(EDITOR_SHELL_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
