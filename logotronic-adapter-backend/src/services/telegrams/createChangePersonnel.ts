// src/service/createChangePersonnel.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { mqttClientInstance } from "../dataprocessing";
import { config } from "../../config/config";
import { IPublishMessage } from "../../dataset/common";

/**
 * Logotronic Request Builder for createChangePersonnel service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for createChangePersonnel service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.typeId"
    ) || rapidaTypeIds.createChangePersonnel;

  const internalId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.internalId"
    ) || "";
  const id =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.id"
    ) || "";
  const firstName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.firstName"
    ) || "";
  const lastName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.lastName"
    ) || "";
  const job =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.job"
    ) || "";
  const password =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.password"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Personal internalId="${internalId}" id="${id}" firstName="${firstName}" lastName="${lastName}" job="${job}" password="${password}" />
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `createChangePersonnel request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send createChangePersonnel request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn(
        "createChangePersonnel response handler received empty buffer."
      );
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`createChangePersonnel raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("createChangePersonnel response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== 10038) {
      logger.error(
        `createChangePersonnel response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.createChangePersonnel.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.createChangePersonnel.toMachine.typeId"
      );
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.createChangePersonnel.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.createChangePersonnel.toMachine.returnCode"
      );
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.createChangePersonnel.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.createChangePersonnel.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "createChangePersonnel response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `createChangePersonnel response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.createChangePersonnel.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.createChangePersonnel.command.done' in tagStore. Cannot publish done message."
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
          `Published 'createChangePersonnel' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish createChangePersonnel response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in createChangePersonnel logotronicResponseHandler: ${err}`
    );
  }
}
