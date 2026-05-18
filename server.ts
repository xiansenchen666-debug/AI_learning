const htmlCache = new Map<string, string>();

async function getHtml(filename: string) {
  if (htmlCache.has(filename)) {
    // return htmlCache.get(filename)!; // In dev we might want to read fresh
  }
  const content = await Deno.readTextFile(new URL(`./${filename}`, import.meta.url));
  // htmlCache.set(filename, content);
  return content;
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}

Deno.serve({ port: 8000 }, async (request) => {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    return json({ ok: true, service: 'ai-learning-page' });
  }

  const routes: Record<string, string> = {
    '/': 'dashboard.html',
    '/login': 'login.html',
    '/dashboard': 'dashboard.html',
    '/subjects': 'subjects.html',
    '/mistakes': 'mistakes.html',
    '/growth': 'growth.html',
  };

  const targetFile = routes[url.pathname];

  if (targetFile) {
    try {
      const content = await getHtml(targetFile);
      return new Response(content, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        },
      });
    } catch (err) {
      console.error(err);
      return new Response('Internal Server Error or File Not Found', { status: 500 });
    }
  }

  return new Response('Not Found', { status: 404 });
});
