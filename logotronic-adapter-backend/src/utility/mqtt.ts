import * as mqtt from "mqtt";
import logger from "./logger";
import { IMessage } from "../dataset/common";

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
    });

    this.client.on("error", (error) => {
      logger.error(`${clientId} MQTT Client Error: ${error}`);
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
