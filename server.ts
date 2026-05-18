const html = await Deno.readTextFile(new URL('./index.html', import.meta.url));

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

Deno.serve({ port: 8000 }, (request) => {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    return json({ ok: true, service: 'ai-learning-page' });
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  return new Response('Not Found', { status: 404 });
});
