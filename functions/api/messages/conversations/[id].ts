import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestGet: PagesFunction = async ({ params }) => {
  return new Response(
    JSON.stringify({ ok: true, route: "messages/conversations/[id]", id: (params as any)?.id }),
    { headers: { "Content-Type": "application/json" } }
  );
};
