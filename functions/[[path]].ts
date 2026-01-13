export async function onRequest(context: any) {
  const url = new URL(context.request.url);

  // If it's a real file (has a dot) serve it directly
  if (url.pathname.includes(".")) {
    return context.env.ASSETS.fetch(context.request);
  }

  // Otherwise serve the SPA shell
  return context.env.ASSETS.fetch(new Request(new URL("/", url), context.request));
}
