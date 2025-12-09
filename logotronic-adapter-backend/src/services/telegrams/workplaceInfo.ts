// src/service/workplaceInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for workplaceInfo service");

  const typeId = rapidaTypeIds.workplaceInfo;

  // WP_INFO is a header-only request
  const bodyBuffer = Buffer.alloc(0);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`workplaceInfo request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send workplaceInfo request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    logger.info(
      `Logotronic Response Handler is called for workplaceInfo service`
    );

    // 1. Parse the responseBody buffer
    let offset = 0;

    const workplaceName = responseBody
      .toString("ascii", offset, offset + 31)
      .replace(/\0/g, "")
      .trim();
    offset += 31;

    const workplaceType = responseBody
      .toString("ascii", offset, offset + 11)
      .replace(/\0/g, "")
      .trim();
    offset += 11;

    const workplaceDataLength = responseBody.readUInt32BE(offset);
    offset += 4;

    const workplaceData = responseBody.slice(
      offset,
      offset + workplaceDataLength
    );

    logger.debug(
      `Parsed WorkplaceInfo Response: Name='${workplaceName}', Type='${workplaceType}', DataLength=${workplaceDataLength}`
    );

    // 2. Get Tag IDs from tagStore
    const nameTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.workplaceInfo.toMachine.workplaceName"
    );
    const typeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.workplaceInfo.toMachine.workplaceType"
    );
    const lengthTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.workplaceInfo.toMachine.workplaceDataLength"
    );
    const dataTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.workplaceInfo.toMachine.workplaceData"
    );

    if (!nameTag || !typeTag || !lengthTag || !dataTag) {
      logger.error(
        "Could not find one or more required tags in tagStore for 'workplaceInfo' response. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload
    const vals = [
      {
        id: nameTag.id,
        val: workplaceName,
      },
      {
        id: typeTag.id,
        val: workplaceType,
      },
      {
        id: lengthTag.id,
        val: workplaceDataLength,
      },
      {
        id: dataTag.id,
        // Representing binary data as a hex string for MQTT
        val: workplaceData.toString("hex"),
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
      logger.info(
        `Published 'workplaceInfo' response data to MQTT topic: ${topic}`
      );

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.workplaceInfo.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.workplaceInfo.command.done' in tagStore. Cannot publish done message."
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
          `Published 'workplaceInfo' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'workplaceInfo' response data."
      );
    }
  } catch (error) {
    logger.error(
      `Error in logotronicResponseHandler for workplaceInfo: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
