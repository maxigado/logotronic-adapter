import * as net from "net";
import logger from "./logger";

class TCPClient {
  public client: net.Socket;
  public host: string;
  public port: number;
  public isConnected: boolean = false;
  public clientId: string;

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
      `Client is connected to  ${this.clientId} at ${this.host}:${this.port}`
    );

    updateMachineStatus(this.clientId, 1);
  }

  public onData(data: Buffer) {
    logger.info(`Received message from  ${this.clientId}: ${data}`);
    const message = data.toString("hex").toUpperCase();
    logger.info(`Received message from  ${this.clientId} (hex): ${message}`);
  }

  public onClose() {
    this.client.destroy();
    this.isConnected = false;
    logger.info(
      `Client disconnected from ${this.clientId}  at ${this.host}:${this.port}`
    );

    updateMachineStatus(this.clientId, 0);

    this.reconnect();
  }

  public onError(error: Error) {
    logger.error(`${this.clientId} Error: ${error.message}`);

    updateMachineStatus(this.clientId, 0);

    this.client.destroy();
  }

  public reconnect() {
    setTimeout(() => {
      if (!this.isConnected) {
        logger.info(
          `Client reconnecting to ${this.clientId}  at ${this.host}:${this.port}`
        );
        this.client.connect(this.port, this.host);
      }
    }, 60000);
  }

  public connect() {
    this.client.connect(this.port, this.host);
  }

  public send(message: string) {
    if (this.isConnected) {
      this.client.write(Buffer.from(message, "hex"));
    } else {
      logger.error(`Client is not connected to ${this.clientId}`);
    }
  }

  public disconnect() {
    this.client.end();
  }
}

export default TCPClient;

function updateMachineStatus(clientId: string, status: number) {
  return "OK  ";
}
