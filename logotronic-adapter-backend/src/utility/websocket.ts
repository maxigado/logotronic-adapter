// src/utility/websocket.ts

import logger from "./logger";
import { Server, Socket } from "socket.io";
// import { statusStoreInstance } from "../service/statusstore"; // <-- KALDIRILDI

class WebSocketManager {
  private static instance: WebSocketManager;
  private io: Server;
  // Yeni: Dışarıdan enjekte edilecek olay işleyicileri
  private onConnectHandler: ((socket: Socket) => void) | null = null;
  private onDisconnectHandler: (() => void) | null = null;

  private constructor() {
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

  // Yeni: Bağlantı olayları için hook atama metotları
  public setOnConnectHandler(handler: (socket: Socket) => void): void {
    this.onConnectHandler = handler;
  }

  public setOnDisconnectHandler(handler: () => void): void {
    this.onDisconnectHandler = handler;
  }

  public start(server: any): void {
    this.io.attach(server);
    this.io.on("connection", (socket: Socket) => {
      logger.info(`New connection: ${socket.id}`);

      // Enjekte edilen bağlantı işleyicisini çağır
      if (this.onConnectHandler) {
        this.onConnectHandler(socket);
      }

      socket.on("disconnect", () => {
        logger.info(`Disconnected: ${socket.id}`);
        // Enjekte edilen bağlantı kesilme işleyicisini çağır
        if (this.onDisconnectHandler) {
          this.onDisconnectHandler();
        }
      });
    });
  }

  public getIo(): Server {
    return this.io;
  }

  public broadcast(eventName: string, data: any): void {
    this.io.sockets.emit(eventName, data);
  }

  public getClientCount(): number {
    return this.io.engine.clientsCount;
  }
}

export default WebSocketManager;
