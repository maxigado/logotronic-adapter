import { config } from "../config/config";
import MQTTClient from "../utility/mqtt";
import logger from "../utility/logger";
import { IMessage } from "../dataset/common";

export let mqttClientInstance: MQTTClient;

const dataprocessing = {
  initdataprocessing() {
    logger.info("Initialize Data Processing Service");
    try {
      mqttClientInstance = new MQTTClient(
        config.databus.url,
        config.databus.username,
        config.databus.password,
        config.databus.client
      );
      logger.info("Trying to connect Databus");

      mqttClientInstance.client.on("connect", () => {
        logger.info("MQTT Client is connected to Databus");
        mqttClientInstance.subscribe(config.databus.topic.read);
        mqttClientInstance.subscribe(config.databus.topic.status);
        mqttClientInstance.subscribe(config.databus.topic.metadata);
        setTimeout(() => {
          messageListener();
        }, 1000);

        setTimeout(() => {
          const updateRequestTopic = config.databus.topic.update;
          const updateRequestMessage: any = { Path: "s7c1" };
          mqttClientInstance.publish(updateRequestTopic, updateRequestMessage);
        }, 2000);
      });
    } catch (error) {
      logger.error(error);
    }
  },
};
export default dataprocessing;

function messageListener() {
  mqttClientInstance.client.on("message", (topic, data) => {
    try {
      const message: IMessage = JSON.parse(data.toString());
      if (topic === config.databus.topic.status) {
        logger.info(`Received status message from topic: ${topic}`);
        processStatusMessage(message, topic);
      } else if (topic === config.databus.topic.metadata) {
        logger.info(`Received update message from topic: ${topic}`);
        processMetadataMessage(message, topic);
      } else if (topic === config.databus.topic.read) {
        logger.info(`Received message from data topic: ${topic}`);
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
  logger.info(`Processing message from topic ${topic}:`, message);
}
