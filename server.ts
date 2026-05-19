async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let filepath = url.pathname;

  // Simple routing mapping
  if (filepath === "/" || filepath === "/dashboard") {
    filepath = "/dashboard.html";
  } else if (filepath === "/login") {
    filepath = "/login.html";
  } else if (filepath === "/subjects") {
    filepath = "/subjects.html";
  } else if (filepath === "/course") {
    filepath = "/course.html";
  } else if (filepath === "/mistakes") {
    filepath = "/mistakes.html";
  } else if (filepath === "/growth") {
    filepath = "/growth.html";
  }

  // Handle mock API routes
  if (filepath === "/api/login") {
    if (req.method === "POST") {
      // Mock login - always redirect to dashboard
      return new Response(null, {
        status: 302,
        headers: { "Location": "/dashboard" },
      });
    }
  } else if (filepath === "/api/logout") {
    return new Response(null, {
      status: 302,
      headers: { "Location": "/login" },
    });
  }

  try {
    // Serve static files relative to the current module's URL (more robust for Deno Deploy)
    const fileUrl = new URL(`.${filepath}`, import.meta.url);
    const file = await Deno.readFile(fileUrl);
    
    const headers = new Headers();
    if (filepath.endsWith(".html")) headers.set("Content-Type", "text/html; charset=utf-8");
    else if (filepath.endsWith(".css")) headers.set("Content-Type", "text/css; charset=utf-8");
    else if (filepath.endsWith(".js")) headers.set("Content-Type", "application/javascript; charset=utf-8");
    else if (filepath.endsWith(".json")) headers.set("Content-Type", "application/json; charset=utf-8");

    return new Response(file, { headers });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return new Response("404 Not Found", { status: 404 });
    }
    console.error("Server error:", e);
    return new Response("500 Internal Server Error", { status: 500 });
  }
}

// Modern Deno API, automatically handles port assignment on Deno Deploy
Deno.serve(handler);
