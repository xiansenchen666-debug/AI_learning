const routeMap: Record<string, string> = {
  "/": "./login.html",
  "/dashboard": "./dashboard.html",
  "/course": "./course.html",
  "/ai": "./ai.html",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Support query params by just checking pathname
  const path = url.pathname;
  
  const filePath = routeMap[path];
  
  if (filePath) {
    try {
      const content = await Deno.readTextFile(filePath);
      return new Response(content, {
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    } catch (e) {
      console.error(e);
      return new Response("Error loading page. Ensure all HTML files exist in the directory.", { status: 500 });
    }
  }
  
  return new Response("Not Found", { status: 404 });
});