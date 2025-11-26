// src/service/machineShifts.ts
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
 * Logotronic Request Builder for machineShifts service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for machineShifts service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineShifts.toServer.typeId"
    ) || rapidaTypeIds.machineShifts;

  // 1. Telegram's XML body is simple for this request
  const serviceXml = `<Request typeId="${typeId}"/>`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`machineShifts request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machineShifts request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "machineShifts response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for machineShifts service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "machineShifts response handler could not parse XML; aborting."
    );
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "machineShifts response handler could not extract meta/domain; aborting."
    );
    return;
  }

  const expectedTypeId = parseInt(rapidaTypeIds.machineShifts, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `machineShifts response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const ms = domain as any; // has days[] and shiftCount

  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.machineShifts.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.machineShifts.toMachine.returnCode"
  );
  const shiftCountTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.machineShifts.toMachine.shiftCount"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.machineShifts.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "machineShifts response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if (shiftCountTag && ms.shiftCount !== undefined) {
    vals.push({ id: shiftCountTag.id, val: ms.shiftCount });
  }

  // Include errorReason ONLY when returnCode is -1 per spec
  if (
    domain.returnCode === -1 &&
    errorReasonTag &&
    ms.errorReason !== undefined
  ) {
    vals.push({ id: errorReasonTag.id, val: ms.errorReason });
  }

  // Up to 7 ShiftDay entries, each up to 3 Shift entries
  for (let dIdx = 0; dIdx < 7; dIdx++) {
    const day = ms.days?.[dIdx];
    if (!day) break;
    const dayValueTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.machineShifts.toMachine.machineShifts.shiftDay[${
        dIdx + 1
      }].value`
    );
    if (dayValueTag && day.value !== undefined) {
      vals.push({ id: dayValueTag.id, val: day.value });
    }
    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const shift = day.shifts?.[sIdx];
      if (!shift) break;
      const basePath = `LTA-Data.machineShifts.toMachine.machineShifts.shiftDay[${
        dIdx + 1
      }].shift[${sIdx + 1}]`;
      const shiftNoTag = tagStoreInstance.getTagDataByTagName(
        `${basePath}.shiftNo`
      );
      const startTimeTag = tagStoreInstance.getTagDataByTagName(
        `${basePath}.startTime`
      );
      const endTimeTag = tagStoreInstance.getTagDataByTagName(
        `${basePath}.endTime`
      );
      const startDayTag = tagStoreInstance.getTagDataByTagName(
        `${basePath}.startDay`
      );
      if (shiftNoTag && shift.shiftNo !== undefined)
        vals.push({ id: shiftNoTag.id, val: shift.shiftNo });
      if (startTimeTag && shift.startTime !== undefined)
        vals.push({ id: startTimeTag.id, val: shift.startTime });
      if (endTimeTag && shift.endTime !== undefined)
        vals.push({ id: endTimeTag.id, val: shift.endTime });
      if (startDayTag && shift.startDay !== undefined)
        vals.push({ id: startDayTag.id, val: shift.startDay });
    }
  }

  if (vals.length === 0) {
    logger.warn(
      "machineShifts response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `machineShifts response published with ${vals.length} values (including ${
        ms.days?.length || 0
      } shiftDay entries).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.machineShifts.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.machineShifts.command.done' in tagStore. Cannot publish done message."
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
        `Published 'machineShifts' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish machineShifts response: ${(err as Error).message}`
    );
  }
}
