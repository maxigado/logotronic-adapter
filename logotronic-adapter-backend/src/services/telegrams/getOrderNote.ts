// src/service/getOrderNote.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
// merged import above
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for getOrderNote service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.typeId"
    ) || rapidaTypeIds.getOrderNote;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.job.prodNo"
    ) || "";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.job.jobNo"
    ) || "";

  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`getOrderNote request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send getOrderNote request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "getOrderNote response handler received empty buffer; ignoring."
    );
    return;
  }
  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for getOrderNote service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "getOrderNote response handler could not parse XML; aborting."
    );
    return;
  }
  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "getOrderNote response handler could not extract meta/domain; aborting."
    );
    return;
  }

  const expectedTypeId = parseInt(rapidaTypeIds.getOrderNote, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `getOrderNote response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const go = domain as any; // productionOutput / energyLevel / energyMachine

  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.getOrderNote.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.getOrderNote.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.getOrderNote.toMachine.errorReason"
  );
  const productionOutputTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.getOrderNote.toMachine.productionOutput"
  );
  const energyLevelTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.getOrderNote.toMachine.energyLevel"
  );
  const energyMachineTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.getOrderNote.toMachine.energyMachine"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "getOrderNote response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  // Include errorReason ONLY when returnCode is not 1
  if (
    domain.returnCode !== 1 &&
    errorReasonTag &&
    go.errorReason !== undefined
  ) {
    vals.push({ id: errorReasonTag.id, val: go.errorReason });
  }

  // Handle OrderNote text mapped into 2 chunks
  // Chunk 0: first 254 characters -> orderNote[0]
  // Chunk 1: next 254 characters (positions 254..507) -> orderNote[1]
  if (go.orderNote && typeof go.orderNote === "string") {
    const text: string = go.orderNote;
    const chunk0 = text.substring(0, 254);
    const chunk1 = text.length > 254 ? text.substring(254, 508) : "";
    const chunk2 = text.length > 508 ? text.substring(508, 762) : "";
    const chunk3 = text.length > 762 ? text.substring(762, 1016) : "";
    const chunk4 = text.length > 1016 ? text.substring(1016, 1270) : "";
    const chunk5 = text.length > 1270 ? text.substring(1270, 1524) : "";
    const chunk6 = text.length > 1524 ? text.substring(1524, 1778) : "";
    const chunk7 = text.length > 1778 ? text.substring(1778, 2032) : "";
    const chunk8 = text.length > 2032 ? text.substring(2032, 2286) : "";
    const chunk9 = text.length > 2286 ? text.substring(2286, 2540) : "";

    const tag0 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[0]"
    );
    const tag1 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[1]"
    );
    const tag2 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[2]"
    );
    const tag3 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[3]"
    );
    const tag4 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[4]"
    );
    const tag5 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[5]"
    );
    const tag6 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[6]"
    );
    const tag7 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[7]"
    );
    const tag8 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[8]"
    );
    const tag9 = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.getOrderNote.toMachine.orderNote[9]"
    );

    if (tag0) {
      vals.push({ id: tag0.id, val: chunk0 });
    }
    if (tag1) {
      vals.push({ id: tag1.id, val: chunk1 });
    }
    if (tag2) {
      vals.push({ id: tag2.id, val: chunk2 });
    }
    if (tag3) {
      vals.push({ id: tag3.id, val: chunk3 });
    }
    if (tag4) {
      vals.push({ id: tag4.id, val: chunk4 });
    }
    if (tag5) {
      vals.push({ id: tag5.id, val: chunk5 });
    }
    if (tag6) {
      vals.push({ id: tag6.id, val: chunk6 });
    }
    if (tag7) {
      vals.push({ id: tag7.id, val: chunk7 });
    }
    if (tag8) {
      vals.push({ id: tag8.id, val: chunk8 });
    }
    if (tag9) {
      vals.push({ id: tag9.id, val: chunk9 });
    }
  }

  // Handle legacy attribute-based properties
  if (productionOutputTag && go.productionOutput !== undefined) {
    vals.push({ id: productionOutputTag.id, val: go.productionOutput });
  }
  if (energyLevelTag && go.energyLevel !== undefined) {
    vals.push({ id: energyLevelTag.id, val: go.energyLevel });
  }
  if (energyMachineTag && go.energyMachine !== undefined) {
    vals.push({ id: energyMachineTag.id, val: go.energyMachine });
  }

  if (vals.length <= 2) {
    // Only contains typeId and returnCode
    logger.warn(
      "getOrderNote response produced no data values to publish (no matching tag IDs for orderNote or other attributes)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(`getOrderNote response published with ${vals.length} values.`);

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.getOrderNote.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.getOrderNote.command.done' in tagStore. Cannot publish done message."
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
        `Published 'getOrderNote' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish getOrderNote response: ${(err as Error).message}`
    );
  }
}
