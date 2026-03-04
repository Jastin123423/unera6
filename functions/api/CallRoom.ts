export class CallRoom {
  state: DurableObjectState;
  env: any;
  sockets = new Map<string, WebSocket>();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const userId = url.searchParams.get("user_id") || "";
    const token = url.searchParams.get("token") || "";

    if (!userId) return new Response("Missing user_id", { status: 400 });

    // 🔒 simple auth; replace with JWT verify later
    if (token !== `unera:${userId}`) return new Response("Unauthorized", { status: 401 });

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sockets.set(userId, server);
    this.broadcast({ type: "peer-joined", user_id: userId }, userId);

    server.addEventListener("message", (evt) => {
      try {
        const msg = JSON.parse(String(evt.data || "{}"));

        if (msg?.to) {
          const ws = this.sockets.get(String(msg.to));
          if (ws) ws.send(JSON.stringify({ ...msg, from: userId }));
        } else {
          this.broadcast({ ...msg, from: userId }, userId);
        }
      } catch {}
    });

    server.addEventListener("close", () => {
      this.sockets.delete(userId);
      this.broadcast({ type: "peer-left", user_id: userId }, userId);
    });

    server.addEventListener("error", () => {
      this.sockets.delete(userId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(payload: any, exceptUserId?: string) {
    const text = JSON.stringify(payload);
    for (const [uid, ws] of this.sockets.entries()) {
      if (exceptUserId && uid === exceptUserId) continue;
      try { ws.send(text); } catch {}
    }
  }
}
