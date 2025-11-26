// src/service/disconnect.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { config } from "../../config/config";
import { mqttClientInstance } from "../dataprocessing";
import { IPublishMessage } from "../../dataset/common";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for disconnect service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.disconnect.toServer.typeId") ||
    rapidaTypeIds.disconnect;

  const timeStamp =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.disconnect.toServer.disconnect.timeStamp"
    ) || Date.now();
  const reason =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.disconnect.toServer.disconnect.reason"
    ) || "0";

  const serviceXml = `
<Request typeId="${typeId}" >
<Disconnect timeStamp="${timeStamp}" reason="${reason}" />
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`disconnect request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send disconnect request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("disconnect response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`disconnect raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("disconnect response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== 10010) {
      logger.error(
        `disconnect response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    // Extract attributes
    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    // toMachine tags (IDs required for publishing) - use getTagDataByTagName to retrieve id
    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.disconnect.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.disconnect.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.disconnect.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.disconnect.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.disconnect.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn("Tag not found: LTA-Data.disconnect.toMachine.errorReason");
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "disconnect response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `disconnect response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.disconnect.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.disconnect.command.done' in tagStore. Cannot publish done message."
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
          `Published 'disconnect' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish disconnect response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in disconnect logotronicResponseHandler: ${err}`
    );
  }
}
