import * as net from "net";
import logger from "./logger";
import { statusStoreInstance } from "../store/statusstore"; // StatusStore eklendi
// Yeni import: createLogotronicRequestFrame'i kullanmak için Buffer tipini kullanacağız.
// Bu dosya Buffer'ı zaten net modülü üzerinden alıyor.

class TCPClient {
  public client: net.Socket;
  public host: string;
  public port: number;
  public isConnected: boolean = false;
  public clientId: string;
  public autoReconnect: boolean = true;

  constructor(host: string, port: number, clientId: string) {
    this.host = host;
    this.port = port;
    this.clientId = clientId;
    this.client = new net.Socket();
    this.client.on("connect", this.onConnect.bind(this));
    this.client.on("data", this.onData.bind(this));
    this.client.on("close", this.onClose.bind(this));
    this.client.on("error", this.onError.bind(this));
  }

  public onConnect() {
    this.isConnected = true;
    logger.info(
      `Client is connected to ${this.clientId} at ${this.host}:${this.port}`
    );

    statusStoreInstance.setLogotronicStatus("connected"); // Status Güncellemesi
  }

  public onData(data: Buffer) {
    logger.debug(
      `Received message from ${this.clientId}: ${data.toString("hex")}`
    ); // Hex formatında logla
    // Yanıt işleme mantığı burada olacaktır (LogotronicResponseHandler'a yönlendirme)
  }

  public onClose() {
    this.client.destroy();
    this.isConnected = false;
    logger.info(
      `Client disconnected from ${this.clientId} at ${this.host}:${this.port}`
    );

    statusStoreInstance.setLogotronicStatus("disconnected"); // Status Güncellemesi

    // Only auto-reconnect if autoReconnect is enabled
    if (this.autoReconnect) {
      this.reconnect();
    } else {
      logger.info(
        `Auto-reconnect is disabled for ${this.clientId}. Waiting for manual reconnection.`
      );
    }
  }

  public onError(error: Error) {
    logger.error(`${this.clientId} Error: ${error.message}`);

    statusStoreInstance.setLogotronicStatus("error");

    this.client.destroy();
  }

  public reconnect() {
    setTimeout(() => {
      if (!this.isConnected) {
        logger.info(
          `Client reconnecting to ${this.clientId} at ${this.host}:${this.port} (interval 10s).`
        );
        this.client.connect(this.port, this.host);
      }
    }, 10000); // 10 seconds
  }

  public connect() {
    this.client.connect(this.port, this.host);
  }

  /**
   * Logotronic'e binary Buffer mesajı gönderir.
   * @param message createLogotronicRequestFrame'den gelen binary Buffer.
   */
  public send(message: Buffer) {
    if (this.isConnected) {
      // Artık string ve 'hex' yerine doğrudan Buffer gönderiyoruz.
      this.client.write(message);
      logger.info(
        `Sent a Logotronic request with length: ${message.length} bytes.`
      );
      logger.info(`Sent a Logotronic request: ${message.toString("hex")}`);
    } else {
      logger.error(
        `Client is not connected to ${this.clientId}. Cannot send message.`
      );
    }
  }

  public disconnect() {
    this.autoReconnect = false;
    this.client.end();
  }

  /**
   * Sets the auto-reconnect behavior
   * @param enabled Whether to enable auto-reconnect on connection loss
   */
  public setAutoReconnect(enabled: boolean) {
    this.autoReconnect = enabled;
  }
}

export default TCPClient;
