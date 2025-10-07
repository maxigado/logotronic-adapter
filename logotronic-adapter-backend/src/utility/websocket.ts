// websocket.ts

import logger from "./logger";
import { Server, Socket } from "socket.io";

class WebSocketManager {
  private static instance: WebSocketManager;
  private io: Server;

  private constructor() {
    // Initialize the WebSocket server
    this.io = new Server({
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }

    return WebSocketManager.instance;
  }

  public start(server: any): void {
    this.io.attach(server);
    this.io.on("connection", (socket: Socket) => {
      logger.info(`New connection: ${socket.id}`);
      socket.on("disconnect", () => {
        logger.info(`Disconnected: ${socket.id}`);
      });
    });
  }

  public getIo(): Server {
    return this.io;
  }
}

export default WebSocketManager;
