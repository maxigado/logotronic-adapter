import * as mqtt from "mqtt";
import logger from "./logger";
import { IMessage } from "../dataset/common";
import { statusStoreInstance } from "../service/statusstore"; // StatusStore eklendi

class MQTTClient {
  public client: mqtt.MqttClient;
  constructor(
    brokerUrl: string,
    username: string,
    password: string,
    clientId: string
  ) {
    this.client = mqtt.connect(brokerUrl, {
      username: username,
      password: password,
      clientId: clientId,
    });

    this.client.on("connect", () => {
      logger.info(`${clientId} is connected to MQTT broker at ${brokerUrl}`);
      statusStoreInstance.setDatabusStatus("connected"); // Status Güncellemesi
    });

    this.client.on("error", (error) => {
      logger.error(`${clientId} MQTT Client Error: ${error}`);
      statusStoreInstance.setDatabusStatus("error"); // Status Güncellemesi
    });

    this.client.on("reconnect", () => {
      logger.warn(`${clientId} is reconnecting to MQTT broker...`);
    });

    this.client.on("close", () => {
      logger.warn(`${clientId} MQTT connection closed.`);
      statusStoreInstance.setDatabusStatus("disconnected"); // Status Güncellemesi
    });

    this.client.on("disconnect", (packet) => {
      logger.error(
        `${clientId} disconnected from MQTT broker. Reason: ${packet.reasonCode}`
      );
      statusStoreInstance.setDatabusStatus("disconnected"); // Status Güncellemesi
    });
  }

  public subscribe(topic: string) {
    this.client.subscribe(topic, (error) => {
      if (error) {
        logger.error("Error subscribing to topic:", error);
      } else {
        logger.info(`Subscribed to topic: ${topic}`);
      }
    });
  }

  public publish(topic: string, message: IMessage) {
    const data = JSON.stringify(message);
    this.client.publish(topic, data, (error) => {
      if (error) {
        logger.error("Error publishing message:", error);
      } else {
        logger.info(`Published to topic: ${topic}`);
      }
    });
  }
}

export default MQTTClient;
