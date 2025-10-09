// src/service/dataprocessing.ts

import { config } from "../config/config";
import MQTTClient from "../utility/mqtt";
import TCPClient from "../utility/tcp";
import logger from "../utility/logger";
import { IMessage } from "../dataset/common";
import { IMetadataMessage } from "../dataset/metadata"; // Yeni arayüz importu
import { tagStoreInstance } from "./tagstore"; // Yeni servis importu
import { IStatusMessage } from "../dataset/status"; // Yeni tip eklendi
import { statusStoreInstance } from "../service/statusstore"; // StatusStore eklendi
export let mqttClientInstance: MQTTClient;
export let tcpClientInstance: TCPClient;

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
          MQTTLister();
        }, 1000);

        setTimeout(() => {
          const updateRequestTopic = config.databus.topic.update;
          const updateRequestMessage: any = { Path: "s7c1" };
          mqttClientInstance.publish(updateRequestTopic, updateRequestMessage);
        }, 2000);
      });

      logger.info("Trying to connect Logotronic Server");
      tcpClientInstance = new TCPClient(
        config.logotronicserver.host,
        config.logotronicserver.port,
        "LogotronicServer"
      );

      tcpClientInstance.client.on("connect", () => {
        logger.info("TCP Client is connected to Logotronic Server");
        TCPListener();
      });
      tcpClientInstance.connect();
    } catch (error) {
      logger.error(error);
    }
  },
};
export default dataprocessing;

function MQTTLister() {
  mqttClientInstance.client.on("message", (topic, data) => {
    try {
      // Mesajı json olarak parse et (tip kontrolü fonksiyonlar içinde yapılacaktır)
      const message = JSON.parse(data.toString());

      if (topic === config.databus.topic.status) {
        logger.info(`Received status message from topic: ${topic}`);
        // Status mesajları için IMessage tipini kullan
        processStatusMessage(message as IStatusMessage, topic);
      } else if (topic === config.databus.topic.metadata) {
        logger.info(`Received metadata message from topic: ${topic}`);
        // Metadata mesajları için yeni IMetadataMessage tipini kullan
        processMetadataMessage(message as IMetadataMessage, topic);
      } else if (topic === config.databus.topic.read) {
        logger.debug(`Received message from data topic: ${topic}`);
        // Data mesajları için TagStore güncelleme fonksiyonunu çağır
        processMachineMessage(message, topic);
      } else {
        logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error parsing MQTT message from topic ${topic}:`, error);
    }
  });
}

function TCPListener() {
  tcpClientInstance.client.on("data", (data: Buffer) => {
    logger.info(
      `Received raw TCP data from Logotronic Server. Length: ${data.length}`
    );
    processLogotricResponse(data);
  });
}

function processStatusMessage(message: IStatusMessage, topic: string) {
  logger.info(`Processing status message:`, message);
  statusStoreInstance.updateMachineStatus(message);
}

// **GÜNCEL FONKSİYON:** Metadata mesajını TagStore'u başlatmak için kullan
function processMetadataMessage(message: IMetadataMessage, topic: string) {
  logger.info(`Processing metadata message:`, message);
  tagStoreInstance.initialize(message);
}

// **GÜNCEL FONKSİYON:** Makine veri mesajını TagStore'daki değerleri güncellemek için kullan
function processMachineMessage(message: any, topic: string) {
  logger.debug(`Processing machine data message from topic ${topic}.`);
  tagStoreInstance.updateValues(message);

  // Örnek: Başarılı güncellemeyi test etmek için TagStore'dan bir değer okuma
  // const versionValue = tagStoreInstance.getValueByTagName("LTA-Data.frame.request.header.version");
  // logger.debug(`LTA-Data.frame.request.header.version value from TagStore: ${versionValue}`);
}

function processLogotricResponse(data: Buffer) {
  const xmlResponse = data.toString("utf8");
  logger.info("Processing Logotronic XML Response: " + xmlResponse);
}
