

export async function onRequest(context: any) {
  const url = new URL(context.request.url);

  // Allow real files (assets)
  if (url.pathname.includes(".")) {
    return context.next();
  }

  // SPA fallback
  return context.env.ASSETS.fetch(
    new Request(new URL("/", url), context.request)
  );
}
