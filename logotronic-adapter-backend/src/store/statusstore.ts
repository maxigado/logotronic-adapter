// src/service/statusstore.ts

import logger from "../utility/logger";
import WebSocketManager from "../utility/websocket"; // Import is fine here
import {
  IStatusMessage,
  IStatusData,
  ConnectionStatus,
  DatabusStatus,
  LogotronicStatus,
} from "../dataset/status";

const WEBSOCKET_EVENT = "statusUpdate";

class StatusStore {
  private static instance: StatusStore;
  private store: IStatusData;
  // Tembel yükleme için başlatıcıdan kaldırıldı:
  private wsManager: WebSocketManager | null = null;
  private periodicInterval: NodeJS.Timeout | null = null;
  private readonly PERIODIC_INTERVAL_MS = 60000;

  private constructor() {
    this.store = {
      databus: "disconnected",
      logotronic: "disconnected",
      connector: "disconnected",
    };
    // Hata veren satır kaldırıldı. wsManager şimdi null olarak başlatılıyor.
  }

  public static getInstance(): StatusStore {
    if (!StatusStore.instance) {
      StatusStore.instance = new StatusStore();
    }
    return StatusStore.instance;
  }

  // Yeni: WebSocketManager'a tembel erişim sağlayan getter metot.
  private getWsManager(): WebSocketManager {
    if (!this.wsManager) {
      this.wsManager = WebSocketManager.getInstance();
    }
    return this.wsManager;
  }

  private normalizeStatus(rawStatus: string): ConnectionStatus {
    if (rawStatus === "good") {
      return "connected";
    }
    if (rawStatus === "bad" || rawStatus === "error") {
      return "disconnected";
    }
    return "error";
  }

  public getAll(): { status: IStatusData } {
    return { status: { ...this.store } };
  }

  private pushUpdate(): void {
    const payload = this.getAll();
    this.getWsManager().broadcast(WEBSOCKET_EVENT, payload); // Tembel erişim kullanıldı
    logger.debug(`Status update broadcasted.`);
  }

  public setDatabusStatus(status: DatabusStatus): void {
    if (this.store.databus !== status) {
      this.store.databus = status;
      logger.info(`Databus Status Updated: ${status}`);
      this.pushUpdate();
    }
  }

  public setLogotronicStatus(status: LogotronicStatus): void {
    if (this.store.logotronic !== status) {
      this.store.logotronic = status;
      logger.info(`Logotronic Status Updated: ${status}`);
      this.pushUpdate();
    }
  }

  public updateMachineStatus(message: IStatusMessage): void {
    let changed = false;

    // S7 Connector durumu
    const newConnectorStatus = this.normalizeStatus(message.connector.status);
    if (this.store.connector !== newConnectorStatus) {
      this.store.connector = newConnectorStatus;
      changed = true;
    }

    // Bireysel Makine/PLC bağlantı durumları
    message.connections.forEach((conn) => {
      const normalizedStatus = this.normalizeStatus(conn.status);
      if (this.store[conn.name] !== normalizedStatus) {
        this.store[conn.name] = normalizedStatus;
        changed = true;
        logger.debug(
          `Machine Status Updated (${conn.name}): ${normalizedStatus}`
        );
      }
    });

    if (changed) {
      this.pushUpdate();
    }
  }

  // Yeni: WebSocket dinleyicilerini StatusStore'a bağlayan metot.
  public initializeWebSocketListeners(): void {
    const wsManager = this.getWsManager();

    // Bağlantı kurulduğunda yapılacaklar
    wsManager.setOnConnectHandler((socket: any) => {
      this.startPeriodicUpdates(socket);
    });

    // Bağlantı kesildiğinde yapılacaklar
    wsManager.setOnDisconnectHandler(() => {
      this.stopPeriodicUpdates();
    });

    logger.info("StatusStore initialized WebSocket handlers.");
  }

  public startPeriodicUpdates(socket: any): void {
    // Yeni bağlanan client'a anında mevcut durumu gönder
    socket.emit(WEBSOCKET_EVENT, this.getAll());

    // İlk client bağlandığında periyodik güncelleme mekanizmasını başlat (Çift çalıştırmayı önler)
    if (this.getWsManager().getClientCount() === 1 && !this.periodicInterval) {
      logger.info("Starting periodic status updates (every 1 minute).");
      this.periodicInterval = setInterval(() => {
        this.pushUpdate();
      }, this.PERIODIC_INTERVAL_MS);
    }
  }

  public stopPeriodicUpdates(): void {
    // Socket.io, client count'u async olarak günceller, kısa bir gecikme eklemek gerekir.
    setTimeout(() => {
      if (this.getWsManager().getClientCount() === 0 && this.periodicInterval) {
        clearInterval(this.periodicInterval);
        this.periodicInterval = null;
        logger.info("Stopping periodic status updates.");
      }
    }, 100);
  }
}

export const statusStoreInstance = StatusStore.getInstance();
export default StatusStore;
