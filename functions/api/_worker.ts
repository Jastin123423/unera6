
import { CallRoom } from "./durable/CallRoom";

export { CallRoom };

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // ✅ signaling WS endpoint
    if (url.pathname === "/api/calls/ws") {
      const callId = url.searchParams.get("call_id") || "";
      if (!callId) return new Response("Missing call_id", { status: 400 });

      const id = env.CALL_ROOM.idFromName(`call:${callId}`);
      const stub = env.CALL_ROOM.get(id);
      return stub.fetch(request);
    }

    // ✅ Let Pages Functions handle everything else
    return fetch(request);
  },
};
