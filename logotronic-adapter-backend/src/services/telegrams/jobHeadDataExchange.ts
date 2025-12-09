// src/service/jobHeadDataExchange.ts
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
 * Logotronic Request Builder for jobHeadDataExchange service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for jobHeadDataExchange service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.typeId"
    ) || rapidaTypeIds.jobHeadDataExchange;

  // Job attributes
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.orderNo"
    ) || "";
  const partOrderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.partOrderNo"
    ) || "";
  const printRunNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.printRunNo"
    ) || "";
  const printRunName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.printRunName"
    ) || "";

  // Print attributes
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.amount"
    ) || "0";
  const copy =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.copy"
    ) || "0";
  const subsidy =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.subsidy"
    ) || "0";
  const subsidy2 =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.subsidy2"
    ) || "0";
  const plannedDate =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.plannedDate"
    ) || Date.now().toString();
  const setupTime =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.setupTime"
    ) || "0";
  const printTime =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.printTime"
    ) || "0";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" partOrderNo="${partOrderNo}" printRunNo="${printRunNo}" printRunName="${printRunName}"/>
  <Print amount="${amount}" subsidy="${subsidy}" subsidy2="${subsidy2}" copy="${copy}" plannedDate="${plannedDate}" setupTime="${setupTime}" printTime="${printTime}"/>
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
      `jobHeadDataExchange request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send jobHeadDataExchange request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "jobHeadDataExchange response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for jobHeadDataExchange service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "jobHeadDataExchange response handler could not parse XML; aborting."
    );
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "jobHeadDataExchange response handler could not extract domain/meta; aborting."
    );
    return;
  }

  // domain is meta-only; ensure expected typeId matches protocol constant
  if (domain.typeId !== parseInt(rapidaTypeIds.jobHeadDataExchange, 10)) {
    logger.error(
      `jobHeadDataExchange response typeId mismatch. Expected ${rapidaTypeIds.jobHeadDataExchange} but got ${domain.typeId}`
    );
    return;
  }

  // Retrieve tag IDs (need tag object, not just value). Using getTagDataByTagName gives id field.
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobHeadDataExchange.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobHeadDataExchange.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobHeadDataExchange.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "jobHeadDataExchange response handler missing required tag definitions (typeId or returnCode); aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  // Only include errorReason if returnCode != 1 and tag exists
  if (domain.returnCode !== 1 && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: domain.errorReason ?? "" });
  }

  const publishMessage: IPublishMessage = { seq: 1, vals };

  try {
    mqttClientInstance.publish(
      config.databus.topic.write,
      publishMessage as any
    );
    logger.info(
      `jobHeadDataExchange response published to MQTT with ${vals.length} values.`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.jobHeadDataExchange.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.jobHeadDataExchange.command.done' in tagStore. Cannot publish done message."
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
        `Published 'jobHeadDataExchange' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish jobHeadDataExchange response to MQTT: ${
        (err as Error).message
      }`
    );
  }
}
