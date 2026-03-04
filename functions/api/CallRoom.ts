export class CallRoom {
  state: DurableObjectState;
  sockets = new Map<string, WebSocket>();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const userId = url.searchParams.get("user_id") || "";

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();
    this.sockets.set(userId, server);

    server.addEventListener("message", (evt) => {
      for (const ws of this.sockets.values()) {
        ws.send(evt.data);
      }
    });

    server.addEventListener("close", () => {
      this.sockets.delete(userId);
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }
}
