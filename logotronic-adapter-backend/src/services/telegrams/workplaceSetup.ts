// src/service/workplaceSetup.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for workplaceSetup service"
  );

  const typeId = rapidaTypeIds.workplaceSetup;

  // Get values from tagStore
  const workplaceName =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceName"
    ) as string) || "";
  const workplaceType =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceType"
    ) as string) || "";
  const workplaceDataLength =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceDataLength"
    ) as number) || 0;
  const workplaceData =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceData"
    ) as number) || 0;

  // Create binary body
  const bodyBuffer = Buffer.alloc(47 + workplaceDataLength);

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
    workplaceIDOverride: "", // Empty for WP_SETUP
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `workplaceSetup request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send workplaceSetup request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  logger.info(
    `Logotronic Response Handler is called for workplaceSetup service`
  );

  try {
    if (responseBody.length < 4) {
      logger.error(
        `workplaceSetup response body is too short. Expected 4 bytes, but got ${responseBody.length}.`
      );
      return;
    }
    // 1. Parse the responseBody buffer
    const returnCode = responseBody.readInt32BE(0);
    logger.debug(`Parsed WorkplaceSetup Response: ReturnCode=${returnCode}`);

    // 2. Get Tag ID from tagStore
    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.workplaceSetup.toMachine.returnCode"
    );

    if (!returnCodeTag) {
      logger.error(
        "Could not find the required tag 'LTA-Data.workplaceSetup.toMachine.returnCode' in tagStore. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload
    const vals = [
      {
        id: returnCodeTag.id,
        val: returnCode,
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
        `Published 'workplaceSetup' response data to MQTT topic: ${topic}`
      );

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.workplaceSetup.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.workplaceSetup.command.done' in tagStore. Cannot publish done message."
          );
          return;
        }

        const doneMqttMessage: IPublishMessage = {
          seq: 1, // Sequence number can be managed more dynamically if needed
          vals: [
            {
              id: doneTag.id,
              val: true,
            },
          ],
        };

        mqttClientInstance.publish(topic, doneMqttMessage as any); // Cast to any to match publish signature
        logger.info(
          `Published 'workplaceSetup' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'workplaceSetup' response data."
      );
    }
  } catch (error) {
    logger.error(
      `Failed to parse workplaceSetup response body. Error: ${error}`
    );
  }
}
