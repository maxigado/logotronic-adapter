// src/service/deleteJob.ts
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
  logger.info("Logotronic Request Builder is called for deleteJob service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.deleteJob.toServer.typeId") ||
    rapidaTypeIds.deleteJob;

  const orderNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.deleteJob.toServer.order.number"
    ) || "";
  const partOrderNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.deleteJob.toServer.partOrder.number"
    ) || "";
  const jobNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.deleteJob.toServer.job.number"
    ) || "";

  const serviceXml = `
<Request typeId="${typeId}">
<Order number="${orderNumber}" />
<Job number="${jobNumber}" />
<PartOrder number="${partOrderNumber}" />
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`deleteJob request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send deleteJob request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("deleteJob response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`deleteJob raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("deleteJob response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    const expectedTypeId = Number(rapidaTypeIds.deleteJob);
    if (!domain || domain.typeId !== expectedTypeId) {
      logger.error(
        `deleteJob response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}, expected: ${expectedTypeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.deleteJob.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.deleteJob.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.deleteJob.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.deleteJob.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.deleteJob.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn("Tag not found: LTA-Data.deleteJob.toMachine.errorReason");
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "deleteJob response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `deleteJob response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.deleteJob.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.deleteJob.command.done' in tagStore. Cannot publish done message."
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
          `Published 'deleteJob' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish deleteJob response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in deleteJob logotronicResponseHandler: ${err}`
    );
  }
}
