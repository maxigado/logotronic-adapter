// src/service/assistantTask.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { config } from "../../config/config";
import { IPublishMessage } from "../../dataset/common";
import { mqttClientInstance } from "../dataprocessing";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";

/**
 * Logotronic Request Builder for assistantTask service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for assistantTask service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.typeId"
    ) || rapidaTypeIds.assistantTask;

  const no =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.assistantTask.no"
    ) || "";
  const priority =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.assistantTask.priority"
    ) || "";
  const comment =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.assistantTask.comment"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <AssistantTask no="${no}" priority="${priority}" comment="${comment}" />
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`assistantTask request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send assistantTask request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("assistantTask response handler received empty buffer.");
      return;
    }

    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`assistantTask raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    const domain = parsed ? parseDomainResponse(parsed) : undefined;
    if (!domain) {
      logger.error(
        `assistantTask response missing mandatory attributes (typeId, returnCode). Raw: ${xmlResponse}`
      );
      return;
    }
    const {
      typeId: typeIdNum,
      returnCode: returnCodeNum,
      errorReason: errorReasonRaw,
    } = domain as any;
    const includeErrorReason = errorReasonRaw !== undefined;

    const vals: { id: string; val: boolean | number | string }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.assistantTask.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeIdNum });
    } else {
      logger.warn("Tag not found for LTA-Data.assistantTask.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.assistantTask.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCodeNum });
    } else {
      logger.warn(
        "Tag not found for LTA-Data.assistantTask.toMachine.returnCode"
      );
    }

    if (includeErrorReason) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.assistantTask.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReasonRaw! });
      } else {
        logger.warn(
          "Tag not found for LTA-Data.assistantTask.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn("assistantTask response produced no tag values to publish.");
      return;
    }

    const mqttMessage: IPublishMessage = {
      seq: 1,
      vals,
    };

    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `assistantTask response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.assistantTask.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.assistantTask.command.done' in tagStore. Cannot publish done message."
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
          `Published 'assistantTask' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish assistantTask response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in assistantTask logotronicResponseHandler: ${err}`
    );
  }
}
