// src/service/info.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for info service");

  const typeId = rapidaTypeIds.info;

  // Mock Inputs
  const workplaceName = "RA162-4"; // char / 30+1
  const workplaceType = "DM"; // char / 10+1
  const workplaceDataLength = 5; // unsigned long
  const workplaceData = 0; // unsigned char

  // Create binary body
  const bodyBuffer = Buffer.alloc(47); // 31 + 11 + 4 + 1

  let offset = 0;

  // Write workplaceName and fill with null characters
  const workplaceNameBuffer = Buffer.from(workplaceName, "ascii");
  workplaceNameBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + workplaceNameBuffer.length, offset + 31);
  offset += 31;

  // Write workplaceType and fill with null characters
  const workplaceTypeBuffer = Buffer.from(workplaceType, "ascii");
  workplaceTypeBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + workplaceTypeBuffer.length, offset + 11);
  offset += 11;

  // Write workplaceDataLength
  bodyBuffer.writeUInt32BE(workplaceDataLength, offset);
  offset += 4;

  // Write workplaceData
  bodyBuffer.writeUInt8(workplaceData, offset);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`info request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send info request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    logger.info(`Logotronic Response Handler is called for info service`);

    // 1. Parse the responseBody buffer
    let offset = 0;
    const infoCode = responseBody.readInt32BE(offset);
    offset += 4;

    const serverInfo = responseBody
      .toString("ascii", offset, offset + 256)
      .replace(/\0/g, "")
      .trim();

    logger.debug(
      `Parsed Info Response: InfoCode=${infoCode}, ServerInfo='${serverInfo}'`
    );

    // 2. Get Tag IDs from tagStore
    const codeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.info.toMachine.code"
    );
    const messageTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.info.toMachine.message"
    );

    if (!codeTag || !messageTag) {
      logger.error(
        "Could not find one or more required tags in tagStore for 'info' response. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload
    const vals = [
      {
        id: codeTag.id,
        val: infoCode,
      },
      {
        id: messageTag.id,
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
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(`Published 'info' response data to MQTT topic: ${topic}`);

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.info.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.info.command.done' in tagStore. Cannot publish done message."
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
          `Published 'info' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'info' response data."
      );
    }
  } catch (error) {
    logger.error(
      `Error in logotronicResponseHandler for info: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
