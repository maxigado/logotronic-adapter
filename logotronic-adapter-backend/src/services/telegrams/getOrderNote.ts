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

  // Handle OrderNote text split into bytes
  if (go.orderNote && typeof go.orderNote === "string") {
    const orderNoteBuffer = Buffer.from(go.orderNote, "utf8");
    for (let i = 0; i < Math.min(1601, orderNoteBuffer.length); i++) {
      const byteTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.getOrderNote.toMachine.orderNote[${i}]`
      );
      if (byteTag) {
        vals.push({ id: byteTag.id, val: orderNoteBuffer[i] });
      }
    }
    // After writing bytes, write a null terminator or clear the next tag
    // to signify the end of the string, if the string is shorter than the max length.
    if (orderNoteBuffer.length < 1601) {
      const nextTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.getOrderNote.toMachine.orderNote[${orderNoteBuffer.length}]`
      );
      if (nextTag) {
        vals.push({ id: nextTag.id, val: 0 }); // Null terminator
      }
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
  } catch (err) {
    logger.error(
      `Failed to publish getOrderNote response: ${(err as Error).message}`
    );
  }
}
