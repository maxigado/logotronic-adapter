// src/service/userEvent.ts
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

/**
 * Logotronic Request Builder for userEvent service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for userEvent service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.userEvent.toServer.typeId") ||
    rapidaTypeIds.userEvent;

  const id =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.id"
    ) || "";
  const incoming =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.incoming"
    ) || "";
  const outgoing =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.outgoing"
    ) || "";
  const comment =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.comment"
    ) || "";
  const rebook =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.rebook"
    ) || "false";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Usermessage id="${id}" incoming="${incoming}" outgoing="${outgoing}" comment="${comment}" rebook="${rebook}" />
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`userEvent request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send userEvent request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("userEvent response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`userEvent raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("userEvent response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== 10012) {
      logger.error(
        `userEvent response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only response

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.userEvent.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.userEvent.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.userEvent.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.userEvent.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.userEvent.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn("Tag not found: LTA-Data.userEvent.toMachine.errorReason");
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "userEvent response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `userEvent response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.userEvent.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.userEvent.command.done' in tagStore. Cannot publish done message."
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
          `Published 'userEvent' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish userEvent response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in userEvent logotronicResponseHandler: ${err}`
    );
  }
}
