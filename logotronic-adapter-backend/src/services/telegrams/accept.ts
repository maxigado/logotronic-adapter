// src/service/accept.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for accept service");

  const typeId = rapidaTypeIds.accept;

  // Mock Inputs
  const currentIndex = 8; // unsigned short
  const maxConnection = 64; // unsigned short
  const serverInfo = "1.0.3.9"; // char / 255 + 1

  // Create binary body
  const bodyBuffer = Buffer.alloc(260); // 2 + 2 + 256

  let offset = 0;
  bodyBuffer.writeUInt16BE(currentIndex, offset);
  offset += 2;

  bodyBuffer.writeUInt16BE(maxConnection, offset);
  offset += 2;

  // Write serverInfo and fill the rest with null characters
  const serverInfoBuffer = Buffer.from(serverInfo, "ascii");
  serverInfoBuffer.copy(bodyBuffer, offset);
  // Fill the rest of the 256 bytes with null characters
  bodyBuffer.fill(0, offset + serverInfoBuffer.length, offset + 256);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    // Using a placeholder for requestType as "ACCEPT" is not a number.
    // This is for testing purposes as requested by the user.
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`accept request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send accept request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  logger.info(`Logotronic Response Handler is called for accept service.`);

  try {
    const expectedLength = 260;
    if (responseBody.length < expectedLength) {
      logger.error(
        `accept response body is too short. Expected ${expectedLength} bytes, but got ${responseBody.length}.`
      );
      return;
    }
    // 1. Parse the responseBody buffer
    let offset = 0;
    const currentIndex = responseBody.readUInt16BE(offset);
    offset += 2;
    const maxConnections = responseBody.readUInt16BE(offset);
    offset += 2;
    const serverInfo = responseBody
      .toString("ascii", offset, offset + 256)
      .replace(/\0/g, "")
      .trim();

    logger.debug(
      `Parsed Accept Response: CurrentIndex=${currentIndex}, MaxConnections=${maxConnections}, ServerInfo='${serverInfo}'`
    );

    // 2. Get Tag IDs from tagStore
    const currentIndexTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.accept.toMachine.currentIndex"
    );
    const maxConnectionsTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.accept.toMachine.maxConnections"
    );
    const serverInfoTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.accept.toMachine.serverInfo"
    );

    if (!currentIndexTag || !maxConnectionsTag || !serverInfoTag) {
      logger.error(
        "Could not find one or more required tags in tagStore for 'accept' response. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload
    const vals = [
      {
        id: currentIndexTag.id,
        val: currentIndex,
      },
      {
        id: maxConnectionsTag.id,
        val: maxConnections,
      },
      {
        id: serverInfoTag.id,
        val: serverInfo,
      },
    ];

    const mqttMessage: IPublishMessage = {
      seq: 1, // Sequence number can be managed more dynamically if needed
      vals: vals,
    };

    // 4. Publish the MQTT message
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any); // Cast to any to match publish signature
      logger.info(`Published 'accept' response data to MQTT topic: ${topic}`);

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.accept.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.accept.command.done' in tagStore. Cannot publish done message."
          );
          return;
        }

        const doneMqttMessage: IPublishMessage = {
          seq: 1,
          vals: [
            {
              id: doneTag.id,
              val: true,
            },
          ],
        };

        mqttClientInstance.publish(topic, doneMqttMessage as any);
        logger.info(
          `Published 'accept' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'accept' response data."
      );
    }
  } catch (error) {
    logger.error(`Failed to parse accept response body. Error: ${error}`);
  }
}
