// src/service/error.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for error service");

  const typeId = rapidaTypeIds.error;

  // Mock Inputs
  const serverInfo = "This is an error message for test purpose."; // char / 255 + 1

  // Create binary body
  const bodyBuffer = Buffer.alloc(256);

  let offset = 0;

  // Write serverInfo and fill the rest with null characters
  const serverInfoBuffer = Buffer.from(serverInfo, "ascii");
  serverInfoBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + serverInfoBuffer.length, offset + 256);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`error request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send error request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  logger.info(`Logotronic Response Handler is called for error service.`);

  try {
    // 1. Parse the responseBody buffer
    // First 4 bytes contain the error code (DInt - signed 32-bit integer, big-endian)
    const errorCode = responseBody.readInt32BE(0);
    // Rest of the body is the error message
    const errorMessage = responseBody
      .subarray(4)
      .toString("ascii")
      .replace(/\0/g, "")
      .trim();

    logger.debug(
      `Parsed Error Response: ErrorCode=${errorCode}, ErrorMessage='${errorMessage}'`
    );

    // 2. Get Tag IDs from tagStore
    const codeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.error.toMachine.code"
    );

    const messageTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.error.toMachine.message"
    );

    if (!codeTag) {
      logger.error(
        "Could not find the required tag 'LTA-Data.error.toMachine.code' in tagStore. Cannot publish MQTT message."
      );
      return;
    }

    if (!messageTag) {
      logger.error(
        "Could not find the required tag 'LTA-Data.error.toMachine.message' in tagStore. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload with both error code and message
    const vals = [
      {
        id: codeTag.id,
        val: errorCode,
      },
      {
        id: messageTag.id,
        val: errorMessage,
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
      logger.info(`Published 'error' response data to MQTT topic: ${topic}`);

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.error.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.error.command.done' in tagStore. Cannot publish done message."
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
          `Published 'error' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'error' response data."
      );
    }
  } catch (error) {
    logger.error(`Failed to parse error response body. Error: ${error}`);
  }
}
