// src/services/telegrams/jobInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { config } from "../../config/config";
import { IPublishMessage } from "../../dataset/common";

/**
 * Logotronic Request Builder for jobInfo service.
 * Sends a request to query job information including planning speed and plus production.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for jobInfo service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.jobInfo.toServer.typeId") ||
    rapidaTypeIds.jobInfo;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobInfo.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobInfo.toServer.job.prodNo"
    ) || "";
  const jobNo =
    tagStoreInstance.getValueByTagName("LTA-Data.jobInfo.toServer.job.jobNo") ||
    "";

  // 1. Construct the XML body for the telegram
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`jobInfo request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send jobInfo request.");
  }
}

/**
 * Logotronic Response Handler for jobInfo service.
 * Processes the response containing job details and publishes to MQTT.
 */
export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn("jobInfo response handler received empty buffer; ignoring.");
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for jobInfo service with response: ${xmlResponse}`
  );

  // Parse XML safely
  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error("jobInfo response handler could not parse XML; aborting.");
    return;
  }

  // Use registry to obtain domain-specific parsed response
  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "jobInfo response handler could not extract meta/domain; aborting."
    );
    return;
  }

  // Validate typeId (strict validation like personnel and jobHeadDataExchange)
  const expectedTypeId = parseInt(rapidaTypeIds.jobInfo, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `jobInfo response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const jobInfoDomain = domain as any; // cast to parsed response type

  // Retrieve meta tag IDs
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "jobInfo response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  // Include errorReason ONLY if returnCode is not 1
  if (domain.returnCode !== 1 && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: domain.errorReason ?? "" });
  }

  // Map domain-specific fields
  const orderNoTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.order.no"
  );
  const prodNoTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.order.prod.no"
  );
  const jobNoTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.order.prod.job.no"
  );
  const planSpeedTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.order.prod.job.planSpeed"
  );
  const plusProductionTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobInfo.toMachine.order.prod.job.plusProduction"
  );

  if (orderNoTag && jobInfoDomain.orderNo !== undefined)
    vals.push({ id: orderNoTag.id, val: jobInfoDomain.orderNo });
  if (prodNoTag && jobInfoDomain.prodNo !== undefined)
    vals.push({ id: prodNoTag.id, val: jobInfoDomain.prodNo });
  if (jobNoTag && jobInfoDomain.jobNo !== undefined)
    vals.push({ id: jobNoTag.id, val: jobInfoDomain.jobNo });
  if (planSpeedTag && jobInfoDomain.planSpeed !== undefined)
    vals.push({ id: planSpeedTag.id, val: jobInfoDomain.planSpeed });
  if (plusProductionTag && jobInfoDomain.plusProduction !== undefined)
    vals.push({ id: plusProductionTag.id, val: jobInfoDomain.plusProduction });

  if (vals.length === 0) {
    logger.warn(
      "jobInfo response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(`jobInfo response published with ${vals.length} values.`);

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.jobInfo.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.jobInfo.command.done' in tagStore. Cannot publish done message."
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

      mqttClientInstance.publish(
        config.databus.topic.write,
        doneMqttMessage as any
      );
      logger.info(
        `Published 'jobInfo' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish jobInfo response: ${(err as Error).message}`
    );
  }
}
