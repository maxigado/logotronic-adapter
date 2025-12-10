// src/service/readRepetitionData.ts
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
 * Logotronic Request Builder for readRepetitionData service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for readRepetitionData service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.typeId"
    ) || rapidaTypeIds.readRepetitionData;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.job.orderNo"
    ) || "x";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.job.prodNo"
    ) || "y";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.job.jobNo"
    ) || "z";
  const identifier =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.readRepetitionData.identifier"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
  <ReadRepetitionData identifier="${identifier}"/>
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
      `readRepetitionData request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send readRepetitionData request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "readRepetitionData response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for readRepetitionData service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "readRepetitionData response handler could not parse XML; aborting."
    );
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "readRepetitionData response handler could not extract domain/meta; aborting."
    );
    return;
  }

  const expectedTypeId = parseInt(rapidaTypeIds.readRepetitionData, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `readRepetitionData response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const rrd = domain as any; // has preset/repro/workplaceName OR rawDataBytes

  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.readRepetitionData.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.readRepetitionData.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.readRepetitionData.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "readRepetitionData response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if ((domain.returnCode === 0 || domain.returnCode === -1) && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: rrd.errorReason ?? "" });
  }

  // If attributes variant
  if (
    rrd.preset !== undefined ||
    rrd.repro !== undefined ||
    rrd.workplaceName !== undefined
  ) {
    const presetTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.readRepetitionData.toMachine.readRepetitionData.preset"
    );
    const reproTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.readRepetitionData.toMachine.readRepetitionData.repro"
    );
    const workplaceNameTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.readRepetitionData.toMachine.readRepetitionData.workplaceName"
    );
    if (presetTag && rrd.preset !== undefined)
      vals.push({ id: presetTag.id, val: rrd.preset });
    if (reproTag && rrd.repro !== undefined)
      vals.push({ id: reproTag.id, val: rrd.repro });
    if (workplaceNameTag && rrd.workplaceName !== undefined)
      vals.push({ id: workplaceNameTag.id, val: rrd.workplaceName });
  }

  // Raw data variant: publish each byte
  if (Array.isArray(rrd.rawDataBytes) && rrd.rawDataBytes.length > 0) {
    for (let i = 0; i < Math.min(2048, rrd.rawDataBytes.length); i++) {
      const byteTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.readRepetitionData.toMachine.readRepetitionData.rawData.byteArray[${i}]`
      );
      if (byteTag) vals.push({ id: byteTag.id, val: rrd.rawDataBytes[i] });
    }
  }

  if (vals.length === 0) {
    logger.warn(
      "readRepetitionData response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `readRepetitionData response published with ${vals.length} values (${
        rrd.rawDataBytes
          ? rrd.rawDataBytes.length + " raw bytes"
          : "attribute variant"
      }).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.readRepetitionData.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.readRepetitionData.command.done' in tagStore. Cannot publish done message."
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
        `Published 'readRepetitionData' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish readRepetitionData response: ${(err as Error).message}`
    );
  }
}
