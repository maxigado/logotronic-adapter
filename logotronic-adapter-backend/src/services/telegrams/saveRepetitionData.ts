// src/service/saveRepetitionData.ts
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
 * Logotronic Request Builder for saveRepetitionData service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for saveRepetitionData service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.typeId"
    ) || rapidaTypeIds.saveRepetitionData;

  // Job attributes (Note: not in the example XML, but included based on inputs)
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.job.orderNo"
    ) || "x";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.job.prodNo"
    ) || "y";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.job.jobNo"
    ) || "z";

  // SaveRepetitionData attributes
  const identifier =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.saveRepetitionData.identifier"
    ) || "";

  // Collect raw data from the buffer tags
  const rawDataChars: string[] = [];
  let i = 0;
  while (true) {
    const byteValue = tagStoreInstance.getValueByTagName(
      `LTA-Data.saveRepetitionData.toServer.saveRepetitionData.rawData.byteArray[${i}]`
    );
    if (byteValue === undefined || byteValue === null) {
      break; // Stop when no more buffer tags are found
    }
    const usintValue = Number(byteValue);
    // Convert USINT to Char, use '*' if value is 0
    const char = String(usintValue);
    rawDataChars.push(char);
    i++;
  }

  // Join characters into a string
  // const base64Data = rawDataChars.join("");

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
  <SaveRepetitionData identifier="${identifier}">${rawDataChars}</SaveRepetitionData>
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
      `saveRepetitionData request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send saveRepetitionData request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("saveRepetitionData response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`saveRepetitionData raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("saveRepetitionData response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== 10050) {
      logger.error(
        `saveRepetitionData response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.saveRepetitionData.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.saveRepetitionData.toMachine.typeId"
      );
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.saveRepetitionData.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.saveRepetitionData.toMachine.returnCode"
      );
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.saveRepetitionData.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.saveRepetitionData.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "saveRepetitionData response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `saveRepetitionData response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.saveRepetitionData.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.saveRepetitionData.command.done' in tagStore. Cannot publish done message."
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
          `Published 'saveRepetitionData' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish saveRepetitionData response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in saveRepetitionData logotronicResponseHandler: ${err}`
    );
  }
}
