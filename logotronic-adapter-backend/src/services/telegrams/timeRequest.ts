// src/service/timeRequest.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for timeRequest service");

  const typeId = rapidaTypeIds.timeRequest;

  // This is a header-only request, so the body is an empty buffer.
  const bodyBuffer = Buffer.alloc(0);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`timeRequest request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send timeRequest request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    logger.info(
      `Logotronic Response Handler is called for timeRequest service`
    );

    // 1. Parse the responseBody buffer
    const unixTime = responseBody.readUInt32BE(0);
    const isSummerTime = responseBody.readUInt16BE(4);

    logger.debug(
      `Parsed TimeRequest Response: UnixTime=${unixTime}, SummerTime=${isSummerTime}`
    );

    // 2. Get Tag IDs from tagStore
    const timeStampTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.timeRequest.toMachine.timeStamp"
    );
    const summerTimeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.timeRequest.toMachine.summerTime"
    );

    if (!timeStampTag || !summerTimeTag) {
      logger.error(
        "Could not find one or more required tags in tagStore for 'timeRequest' response. Cannot publish MQTT message."
      );
      return;
    }

    // 3. Build the MQTT message payload
    const vals = [
      {
        id: timeStampTag.id,
        val: unixTime,
      },
      {
        id: summerTimeTag.id,
        val: isSummerTime === 1, // Convert to boolean
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
      logger.info(
        `Published 'timeRequest' response data to MQTT topic: ${topic}`
      );

      // 5. Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.timeRequest.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.timeRequest.command.done' in tagStore. Cannot publish done message."
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
          `Published 'timeRequest' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client is not connected. Cannot publish 'timeRequest' response data."
      );
    }
  } catch (error) {
    logger.error(
      `Error in logotronicResponseHandler for timeRequest: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
