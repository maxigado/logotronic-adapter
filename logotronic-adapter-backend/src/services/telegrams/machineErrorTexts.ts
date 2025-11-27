// src/services/telegrams/machineErrorTexts.ts
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
 * Logotronic Request Builder for machineErrorTexts service.
 * Sends machine error location and message definitions to the server.
 * Builds request XML with locations array (up to 2) and messages array (up to 2).
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for machineErrorTexts service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineErrorTexts.toServer.typeId"
    ) || rapidaTypeIds.machineErrorTexts;

  const languageId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineErrorTexts.toServer.languageId"
    ) || "";

  // Build Locations array (up to 2 items)
  let locationsXml = "";
  for (let i = 0; i < 2; i++) {
    const no = tagStoreInstance.getValueByTagName(
      `LTA-Data.machineErrorTexts.toServer.locations.loc[${i}].no`
    );

    // Only include location if 'no' exists
    if (no) {
      const text =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machineErrorTexts.toServer.locations.loc[${i}].text`
        ) || "";

      locationsXml += `<Loc no="${no}" text="${text}"/>\n`;
    }
  }

  // Build Messages array (up to 2 items)
  let messagesXml = "";
  for (let i = 0; i < 2; i++) {
    const no = tagStoreInstance.getValueByTagName(
      `LTA-Data.machineErrorTexts.toServer.messages.msg[${i}].no`
    );

    // Only include message if 'no' exists
    if (no) {
      const prio =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machineErrorTexts.toServer.messages.msg[${i}].prio`
        ) || "";
      const grpNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machineErrorTexts.toServer.messages.msg[${i}].grpNo`
        ) || "";
      const text =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machineErrorTexts.toServer.messages.msg[${i}].text`
        ) || "";

      messagesXml += `<Msg no="${no}" prio="${prio}" grpNo="${grpNo}" text="${text}"/>\n`;
    }
  }

  // Construct the full XML request
  const serviceXml = `
<Request typeId="${typeId}">
  <MessagesAndLocations languageId="${languageId}"/>
  <Locations>
    ${locationsXml.trim()}
  </Locations>
  <Messages>
    ${messagesXml.trim()}
  </Messages>
</Request>
`;

  // Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `machineErrorTexts request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machineErrorTexts request."
    );
  }
}

/**
 * Logotronic Response Handler for machineErrorTexts service.
 * Processes the response containing only meta fields (typeId, returnCode, errorReason).
 * No domain-specific data in response body.
 */
export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("machineErrorTexts response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`machineErrorTexts raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("machineErrorTexts response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    const expectedTypeId = Number(rapidaTypeIds.machineErrorTexts);
    if (!domain || (domain as any).typeId !== expectedTypeId) {
      logger.error(
        `machineErrorTexts response domain parsing failed or typeId mismatch. Parsed typeId: ${
          (domain as any)?.typeId
        }, expected: ${expectedTypeId}`
      );
      return;
    }

    // Cast to MachineErrorTextsResponse (contains only meta fields)
    const { typeId, returnCode, errorReason } = domain as any;

    // Get tag IDs for meta fields
    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineErrorTexts.toMachine.typeId"
    );
    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineErrorTexts.toMachine.returnCode"
    );
    const errorReasonTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineErrorTexts.toMachine.errorReason"
    );

    if (!typeIdTag || !returnCodeTag) {
      logger.error(
        "machineErrorTexts response missing required meta tag IDs; aborting publish."
      );
      return;
    }

    const vals: { id: string; val: string | number | boolean }[] = [
      { id: typeIdTag.id, val: typeId },
      { id: returnCodeTag.id, val: returnCode },
    ];

    // Include errorReason ONLY if returnCode is not 1
    if (returnCode !== 1 && errorReasonTag && errorReason !== undefined) {
      vals.push({ id: errorReasonTag.id, val: errorReason });
    }

    if (vals.length === 0) {
      logger.warn(
        "machineErrorTexts response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `machineErrorTexts response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.machineErrorTexts.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.machineErrorTexts.command.done' in tagStore. Cannot publish done message."
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
          `Published 'machineErrorTexts' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish machineErrorTexts response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in machineErrorTexts logotronicResponseHandler: ${err}`
    );
  }
}
