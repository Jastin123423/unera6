import { CallRoom } from "./functions/durable/CallRoom";
export { CallRoom };

export default {
  async fetch(req: Request, env: any) {
    const url = new URL(req.url);

    if (url.pathname === "/api/calls/ws") {
      const callId = url.searchParams.get("call_id") || "";
      if (!callId) return new Response("Missing call_id", { status: 400 });

      const id = env.CALL_ROOM.idFromName(`call:${callId}`);
      return env.CALL_ROOM.get(id).fetch(req);
    }

    return new Response("Not found", { status: 404 });
  },
};
