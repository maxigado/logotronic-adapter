// src/service/userEventsQuery.ts
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
 * Logotronic Request Builder for userEventsQuery service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for userEventsQuery service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEventsQuery.toServer.typeId"
    ) || rapidaTypeIds.userEventsQuery;

  const languageId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEventsQuery.toServer.userEvents.languageId"
    ) || "1";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <UserEvents languageId="${languageId}" />
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
      `userEventsQuery request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send userEventsQuery request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "userEventsQuery response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for userEventsQuery service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "userEventsQuery response handler could not parse XML; aborting."
    );
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "userEventsQuery response handler could not extract domain/meta; aborting."
    );
    return;
  }

  const expectedTypeId = parseInt(rapidaTypeIds.userEventsQuery, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `userEventsQuery response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const uq = domain as any; // has groups[]

  // Tag objects
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.userEventsQuery.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.userEventsQuery.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.userEventsQuery.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "userEventsQuery response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if ((domain.returnCode === 0 || domain.returnCode === -1) && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: uq.errorReason ?? "" });
  }

  // Get max number of event groups from TagStore settings
  const maxNumberOfUserEventGroup =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfUserEventGroup"
    ) as number) || 10;

  // Get max number of user events per group from TagStore settings
  const maxNumberOfUserEvent =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfUserEvent"
    ) as number) || 10;

  // Up to maxNumberOfUserEventGroup EventGroups each up to maxNumberOfUserEvent UserEvents
  for (let gIdx = 0; gIdx < maxNumberOfUserEventGroup; gIdx++) {
    const group = uq.groups?.[gIdx];
    const groupNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].name`
    );
    if (group && groupNameTag && group.name !== undefined) {
      vals.push({ id: groupNameTag.id, val: group.name });
    }

    for (let eIdx = 0; eIdx < maxNumberOfUserEvent; eIdx++) {
      const event = group?.userEvents?.[eIdx];
      if (!event) continue;
      const noTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].no`
      );
      const nameTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].name`
      );
      const typeTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].type`
      );
      const machineTimeTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].machineTime`
      );
      const machineTimeNameTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].machineTimeName`
      );
      const sendPolicyTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].sendPolicy`
      );
      const sendPolicy2Tag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].sendPolicy2`
      );
      const blockingPolicyTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].blockingPolicy`
      );
      const interruptRunTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].interruptRun`
      );
      const speedReductionTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.userEventsQuery.toMachine.eventGroup[${gIdx}].userEvent[${eIdx}].speedReduction`
      );

      if (noTag && event.no !== undefined)
        vals.push({ id: noTag.id, val: event.no });
      if (nameTag && event.name !== undefined)
        vals.push({ id: nameTag.id, val: event.name });
      if (typeTag && event.type !== undefined)
        vals.push({ id: typeTag.id, val: event.type });
      if (machineTimeTag && event.machineTime !== undefined)
        vals.push({ id: machineTimeTag.id, val: event.machineTime });
      if (machineTimeNameTag && event.machineTimeName !== undefined)
        vals.push({ id: machineTimeNameTag.id, val: event.machineTimeName });
      if (sendPolicyTag && event.sendPolicy !== undefined)
        vals.push({ id: sendPolicyTag.id, val: event.sendPolicy });
      if (sendPolicy2Tag && event.sendPolicy2 !== undefined)
        vals.push({ id: sendPolicy2Tag.id, val: event.sendPolicy2 });
      if (blockingPolicyTag && event.blockingPolicy !== undefined)
        vals.push({ id: blockingPolicyTag.id, val: event.blockingPolicy });
      if (interruptRunTag && event.interruptRun !== undefined)
        vals.push({ id: interruptRunTag.id, val: event.interruptRun });
      if (speedReductionTag && event.speedReduction !== undefined)
        vals.push({ id: speedReductionTag.id, val: event.speedReduction });
    }
  }

  if (vals.length === 0) {
    logger.warn(
      "userEventsQuery response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `userEventsQuery response published with ${
        vals.length
      } values (including ${uq.groups?.length || 0} event groups).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.userEventsQuery.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.userEventsQuery.command.done' in tagStore. Cannot publish done message."
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
        `Published 'userEventsQuery' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish userEventsQuery response: ${(err as Error).message}`
    );
  }
}
