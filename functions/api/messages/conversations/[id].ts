import type { PagesFunction } from "@cloudflare/workers-types";

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-user-id",
    },
  });

export const onRequestPut: PagesFunction = async ({ params }) => {
  return new Response(JSON.stringify({ ok: true, method: "PUT", id: (params as any)?.id }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const onRequestDelete: PagesFunction = async ({ params }) => {
  return new Response(JSON.stringify({ ok: true, method: "DELETE", id: (params as any)?.id }), {
    headers: { "Content-Type": "application/json" },
  });
};
