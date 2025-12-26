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
import { tagStoreInstance } from "./tagstore";
import { IPublishMessage } from "../dataset/common";
import { config } from "../config/config";

const WEBSOCKET_EVENT = "statusUpdate";

// Health tag names for MQTT publishing
const HEALTH_TAG_NAMES = {
  plc: "LTA-Settings.application.status.health.plc", // connector status
  server: "LTA-Settings.application.status.health.server", // logotronic status
  app: "LTA-Settings.application.status.health.app", // application status (always 1 if running)
};

class StatusStore {
  private static instance: StatusStore;
  private store: IStatusData;
  // Tembel yükleme için başlatıcıdan kaldırıldı:
  private wsManager: WebSocketManager | null = null;
  private periodicInterval: NodeJS.Timeout | null = null;
  private mqttStatusInterval: NodeJS.Timeout | null = null;
  private readonly PERIODIC_INTERVAL_MS = 10000;
  private readonly MQTT_STATUS_INTERVAL_MS = 10000; // 10 seconds for MQTT status publishing
  private mqttClient: any = null; // Lazy loaded MQTT client reference

  private constructor() {
    this.store = {
      databus: "disconnected",
      logotronic: "disconnected",
      connector: "disconnected",
    };
    // Hata veren satır kaldırıldı. wsManager şimdi null olarak başlatılıyor.

    // Start MQTT status publishing when StatusStore is created
    this.startMqttStatusPublishing();
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
    const lowerStatus = rawStatus.toLowerCase();
    if (lowerStatus === "good" || lowerStatus === "available") {
      return "connected";
    }
    if (
      lowerStatus === "bad" ||
      lowerStatus === "error" ||
      lowerStatus === "unavailable"
    ) {
      return "disconnected";
    }
    // Bilinmeyen durumlar için bir varsayılan dönüş
    logger.warn(`Unknown status value received: ${rawStatus}`);
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

  public updateMachineStatus(message: any): void {
    let changed = false;

    // Gelen mesajın yapısını kontrol et
    if (message.connector && message.connector.status) {
      // Format 1 & 2: { connector: { status: '...' } }
      const newConnectorStatus = this.normalizeStatus(message.connector.status);
      if (this.store.connector !== newConnectorStatus) {
        this.store.connector = newConnectorStatus;
        changed = true;
      }

      // Format 1: { connector: {...}, connections: [...] }
      if (message.connections && Array.isArray(message.connections)) {
        message.connections.forEach((conn: any) => {
          const normalizedStatus = this.normalizeStatus(conn.status);
          if (this.store[conn.name] !== normalizedStatus) {
            this.store[conn.name] = normalizedStatus;
            changed = true;
            logger.debug(
              `Machine Status Updated (${conn.name}): ${normalizedStatus}`
            );
          }
        });
      }
    } else {
      logger.warn("Received status message with unknown format:", message);
      return;
    }

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

  /**
   * Converts connection status to numeric value (1 = good/connected, 0 = bad/disconnected/error)
   */
  private statusToNumeric(
    status: ConnectionStatus | DatabusStatus | LogotronicStatus
  ): number {
    return status === "connected" ? 1 : 0;
  }

  /**
   * Sets the MQTT client reference for publishing status
   * This should be called after the MQTT client is initialized
   */
  public setMqttClient(client: any): void {
    this.mqttClient = client;
    logger.info(
      "StatusStore: MQTT client reference set for status publishing."
    );
  }

  /**
   * Starts periodic MQTT status publishing every 1 minute
   */
  private startMqttStatusPublishing(): void {
    if (this.mqttStatusInterval) {
      logger.warn("MQTT status publishing is already running.");
      return;
    }

    logger.info("Starting MQTT status publishing (every 1 minute).");

    // Publish immediately on start, then every minute
    // Use setTimeout to allow MQTT client to be set first
    setTimeout(() => {
      this.publishStatusToMqtt();
    }, 5000); // Initial delay to allow MQTT connection

    this.mqttStatusInterval = setInterval(() => {
      this.publishStatusToMqtt();
    }, this.MQTT_STATUS_INTERVAL_MS);
  }

  /**
   * Stops MQTT status publishing
   */
  public stopMqttStatusPublishing(): void {
    if (this.mqttStatusInterval) {
      clearInterval(this.mqttStatusInterval);
      this.mqttStatusInterval = null;
      logger.info("Stopped MQTT status publishing.");
    }
  }

  /**
   * Publishes current status to MQTT
   * Maps:
   * - connector status -> LTA-Settings.application.status.health.plc
   * - logotronic status -> LTA-Settings.application.status.health.server
   * - app status (always 1) -> LTA-Settings.application.status.health.app
   */
  private publishStatusToMqtt(): void {
    // Lazy load MQTT client from dataprocessing if not set
    if (!this.mqttClient) {
      try {
        const { mqttClientInstance } = require("../services/dataprocessing");
        this.mqttClient = mqttClientInstance;
      } catch (error) {
        logger.debug("MQTT client not yet available for status publishing.");
        return;
      }
    }

    if (!this.mqttClient || !this.mqttClient.client?.connected) {
      logger.debug("MQTT client not connected. Skipping status publish.");
      return;
    }

    // Get tag data from tagStore
    const plcTag = tagStoreInstance.getTagDataByTagName(HEALTH_TAG_NAMES.plc);
    const serverTag = tagStoreInstance.getTagDataByTagName(
      HEALTH_TAG_NAMES.server
    );
    const appTag = tagStoreInstance.getTagDataByTagName(HEALTH_TAG_NAMES.app);

    if (!plcTag || !serverTag || !appTag) {
      logger.info(
        "Health tags not found in tagStore. Waiting for metadata initialization. " +
          `plc: ${!!plcTag}, server: ${!!serverTag}, app: ${!!appTag}`
      );
      return;
    }

    // Build vals array for MQTT message
    const vals: { id: string; val: number }[] = [
      {
        id: plcTag.id,
        val: this.statusToNumeric(this.store.connector), // connector -> plc
      },
      {
        id: serverTag.id,
        val: this.statusToNumeric(this.store.logotronic), // logotronic -> server
      },
      {
        id: appTag.id,
        val: 1, // app is always 1 as long as it's running
      },
    ];

    const mqttMessage: IPublishMessage = {
      seq: 0,
      vals: vals,
    };

    try {
      const topic = config.databus.topic.write;
      this.mqttClient.publish(topic, mqttMessage as any);
      logger.info(
        `Published health status to MQTT: plc=${vals[0].val}, server=${vals[1].val}, app=${vals[2].val}`
      );
    } catch (error) {
      logger.error("Error publishing health status to MQTT:", error);
    }
  }
}

export const statusStoreInstance = StatusStore.getInstance();
export default StatusStore;
