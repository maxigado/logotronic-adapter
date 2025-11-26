// src/service/versionInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for versionInfo service");

  const typeId = rapidaTypeIds.versionInfo;

  // Get values from tagStore
  const protocolVersion =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.versionInfo.toServer.protocolVersion"
    ) as string) || "0";
  const clientVersion =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.versionInfo.toServer.clientVersion"
    ) as string) || "0";
  const clientRevision =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.versionInfo.toServer.clientRevision"
    ) as string) || "0";

  // Create binary body
  const bodyBuffer = Buffer.alloc(51);

  let offset = 0;

  // Write protocolVersion and fill with null characters
  const protocolVersionBuffer = Buffer.from(protocolVersion, "ascii");
  protocolVersionBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + protocolVersionBuffer.length, offset + 17);
  offset += 17;

  // Write clientVersion and fill with null characters
  const clientVersionBuffer = Buffer.from(clientVersion, "ascii");
  clientVersionBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + clientVersionBuffer.length, offset + 17);
  offset += 17;

  // Write clientRevision and fill with null characters
  const clientRevisionBuffer = Buffer.from(clientRevision, "ascii");
  clientRevisionBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + clientRevisionBuffer.length, offset + 17);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`versionInfo request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send versionInfo request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  logger.info(`Logotronic Response Handler is called for versionInfo service`);

  try {
    const expectedLength = 55;
    if (responseBody.length < expectedLength) {
      logger.error(
        `versionInfo response body is too short. Expected ${expectedLength} bytes, but got ${responseBody.length}.`
      );
      return;
    }
    // 1. Parse the responseBody buffer
    let offset = 0;

    const commFrame = responseBody.readUInt32BE(offset);
    offset += 4;

    const protocolVersion = responseBody
      .toString("ascii", offset, offset + 17)
      .trim()
      .replace(/\0/g, "");
    offset += 17;

    const logotronicVersion = responseBody
      .toString("ascii", offset, offset + 17)
      .trim()
      .replace(/\0/g, "");
    offset += 17;

    const serverRevision = responseBody
      .toString("ascii", offset, offset + 17)
      .trim()
      .replace(/\0/g, "");
    offset += 17;

    logger.debug(
      `Parsed VersionInfo Response: CommFrame=${commFrame}, ProtocolVersion=${protocolVersion}, LogotronicVersion=${logotronicVersion}, ServerRevision=${serverRevision}`
    );

    // 2. Get Tag IDs from tagStore
    const commFrameTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.versionInfo.toMachine.commFrame"
    );
    const protocolVersionTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.versionInfo.toMachine.protocolVersion"
    );
    const logotronicVersionTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.versionInfo.toMachine.logotronicVersion"
    );
    const serverRevisionTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.versionInfo.toMachine.serverRevision"
    );

    if (
      !commFrameTag ||
      !protocolVersionTag ||
      !logotronicVersionTag ||
      !serverRevisionTag
    ) {
      logger.error(
        "Could not find one or more required tags for 'versionInfo' in tagStore. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload
    const vals = [
      { id: commFrameTag.id, val: commFrame },
      { id: protocolVersionTag.id, val: protocolVersion },
      { id: logotronicVersionTag.id, val: logotronicVersion },
      { id: serverRevisionTag.id, val: serverRevision },
    ];

    const mqttMessage: IPublishMessage = {
      seq: 1, // Sequence number can be managed more dynamically if needed
      vals: vals,
    };

    // 4. Publish the MQTT message
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `Published 'versionInfo' response data to MQTT topic: ${topic}`
      );

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.versionInfo.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.versionInfo.command.done' in tagStore. Cannot publish done message."
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
          `Published 'versionInfo' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'versionInfo' response data."
      );
    }
  } catch (error) {
    logger.error(`Failed to parse versionInfo response body. Error: ${error}`);
  }
}
