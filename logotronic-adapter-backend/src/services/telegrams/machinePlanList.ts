// src/service/machinePlanList.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for machinePlanList service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machinePlanList.toServer.typeId"
    ) || rapidaTypeIds.machinePlanList;

  const jobLines: string[] = [];
  for (let i = 0; i < 10; i++) {
    const orderNo = tagStoreInstance.getValueByTagName(
      `LTA-Data.machinePlanList.toServer.job[${i}].orderNo`
    );

    // Only add a job if the order number exists and is not an empty string
    if (orderNo) {
      const prodNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machinePlanList.toServer.job[${i}].prodNo`
        ) || "";
      const jobNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machinePlanList.toServer.job[${i}].jobNo`
        ) || "";

      jobLines.push(
        `<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}" />`
      );
    }
  }

  if (jobLines.length === 0) {
    logger.warn(
      "No jobs found in tagStore to build machinePlanList request. Aborting."
    );
    return;
  }

  const serviceXml = `
<Request typeId="${typeId}">
${jobLines.join("\n")}
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `machinePlanList request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machinePlanList request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("machinePlanList response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`machinePlanList raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("machinePlanList response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    const expectedTypeId = Number(rapidaTypeIds.machinePlanList);
    if (!domain || domain.typeId !== expectedTypeId) {
      logger.error(
        `machinePlanList response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}, expected: ${expectedTypeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    // Use getTagDataByTagName, not getValueByTagName, to access tag IDs
    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machinePlanList.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.machinePlanList.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machinePlanList.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.machinePlanList.toMachine.returnCode"
      );
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.machinePlanList.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.machinePlanList.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "machinePlanList response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `machinePlanList response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.machinePlanList.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.machinePlanList.command.done' in tagStore. Cannot publish done message."
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
          `Published 'machinePlanList' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish machinePlanList response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in machinePlanList logotronicResponseHandler: ${err}`
    );
  }
}
