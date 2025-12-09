// src/service/bdePersonnel.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

/**
 * Logotronic Request Builder for bdePersonnel service.
 * This function can send multiple "Personal" records in one request.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for bdePersonnel service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.bdePersonnel.toServer.typeId"
    ) || rapidaTypeIds.bdePersonnel;

  let personalXmlElements = "";
  // Loop to check for multiple personnel entries, assuming a max of 10.
  for (let i = 0; i < 10; i++) {
    const id = tagStoreInstance.getValueByTagName(
      `LTA-Data.bdePersonnel.toServer.personal[${i}].id`
    );

    // If an ID exists for this index, create a <Personal> element.
    if (id) {
      const activityNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal[${i}].activityNo`
        ) || "";
      const timestamp =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal[${i}].timeStamp`
        ) || Date.now().toString();
      const comment =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal[${i}].comment`
        ) || "";

      personalXmlElements += `<Personal activityNo="${activityNo}" id="${id}" timestamp="${timestamp}" comment="${comment}"/>\n`;
    }
  }

  // If no personnel elements were found, we can either send an empty request or log an error.
  // For now, we'll proceed, which might send a request with an empty body if no tags are set.
  if (!personalXmlElements) {
    logger.warn(
      "No personnel data found in tagStore for bdePersonnel request."
    );
    // Fallback to single-entry tags if multi-entry fails
    const id = tagStoreInstance.getValueByTagName(
      `LTA-Data.bdePersonnel.toServer.personal.id`
    );
    if (id) {
      const activityNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal.activityNo`
        ) || "";
      const timestamp =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal.timeStamp`
        ) || Date.now().toString();
      const comment =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal.comment`
        ) || "";
      personalXmlElements = `<Personal activityNo="${activityNo}" id="${id}" timestamp="${timestamp}" comment="${comment}"/>`;
    }
  }

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  ${personalXmlElements.trim()}
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`bdePersonnel request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send bdePersonnel request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("bdePersonnel response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`bdePersonnel raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("bdePersonnel response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== Number(rapidaTypeIds.bdePersonnel)) {
      logger.error(
        `bdePersonnel response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}, expected: ${rapidaTypeIds.bdePersonnel}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.bdePersonnel.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.bdePersonnel.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.bdePersonnel.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.bdePersonnel.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.bdePersonnel.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.bdePersonnel.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "bdePersonnel response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `bdePersonnel response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.bdePersonnel.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.bdePersonnel.command.done' in tagStore. Cannot publish done message."
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
          `Published 'bdePersonnel' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish bdePersonnel response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in bdePersonnel logotronicResponseHandler: ${err}`
    );
  }
}
