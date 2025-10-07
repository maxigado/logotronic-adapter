import { config } from "../config/config";
import MQTTClient from "../utility/mqtt";
import logger from "../utility/logger";
import { IMessage } from "../dataset/common";

const dataprocessing = {
  initdataprocessing() {
    logger.info("Initialize Data Processing Service");
    try {
      const mqttClient = new MQTTClient(
        config.databus.url,
        config.databus.username,
        config.databus.password,
        config.databus.client
      );
      logger.info("Trying to connect Databus");
      mqttClient.client.on("connect", () => {
        logger.info("MQTT Client is connected to Databus");
        mqttClient.subscribe(config.databus.topic.read);
        mqttClient.subscribe(config.databus.topic.status);
        mqttClient.subscribe(config.databus.topic.metadata);
        setTimeout(() => {
          messageListener(mqttClient);
        }, 1000);

        setTimeout(() => {
          const updateRequestTopic = config.databus.topic.update;
          const updateRequestMessage: any = { Path: "s7c1" };
          mqttClient.publish(updateRequestTopic, updateRequestMessage);
        }, 2000);
      });
    } catch (error) {
      logger.error(error);
    }
  },
};
export default dataprocessing;

function messageListener(mqttClient: MQTTClient) {
  mqttClient.client.on("message", (topic, data) => {
    try {
      const message: IMessage = JSON.parse(data.toString());
      if (topic === config.databus.topic.status) {
        logger.info(`Received status message from topic: ${topic}`);
        processStatusMessage(message, topic);
      } else if (topic === config.databus.topic.metadata) {
        logger.info(`Received update message from topic: ${topic}`);
        processMetadataMessage(message, topic);
      } else if (topic === config.databus.topic.read) {
        logger.debug(`Received message from data topic: ${topic}`);
        processMachineMessage(message, topic);
      } else {
        logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error parsing MQTT message from topic ${topic}:`, error);
    }
  });
}

function processStatusMessage(message: IMessage, topic: string) {
  logger.info(`Processing status message:`, message);
}

function processMetadataMessage(message: IMessage, topic: string) {
  logger.info(`Processing metadata message:`, message);
}

function processMachineMessage(message: IMessage, topic: string) {
  logger.debug(`Processing message from topic ${topic}:`, message);
}
