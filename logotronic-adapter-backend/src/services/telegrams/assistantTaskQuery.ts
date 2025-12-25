// src/service/assistantTask.ts
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
 * Logotronic Request Builder for assistantTaskQuery service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for assistantTaskQuery service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTaskQuery.toServer.typeId"
    ) || rapidaTypeIds.assistantTaskQuery;

  const languageId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTaskQuery.toServer.assistantTask.languageId"
    ) || "1";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <AssistantTasks languageId="${languageId}" />
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
      `assistantTaskQuery request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send assistantTaskQuery request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "assistantTaskQuery response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for assistantTaskQuery service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "assistantTaskQuery response handler could not parse XML; aborting."
    );
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "assistantTaskQuery response handler could not extract domain/meta; aborting."
    );
    return;
  }

  if (domain.typeId !== parseInt(rapidaTypeIds.assistantTaskQuery, 10)) {
    logger.error(
      `assistantTaskQuery response typeId mismatch. Expected ${rapidaTypeIds.assistantTaskQuery} but got ${domain.typeId}`
    );
    return;
  }

  const atq = domain as any; // has groups array from parser

  // Tag retrieval (need IDs, not values) - instructions mention getValueByTagName but we use getTagDataByTagName
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.assistantTaskQuery.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.assistantTaskQuery.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.assistantTaskQuery.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "assistantTaskQuery response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if (domain.returnCode !== 1 && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: atq.errorReason ?? "" });
  }

  // Get max number of task groups from TagStore settings
  const maxNumberOfUserAssistantTaskGroup =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfUserAssistantTaskGroup"
    ) as number) || 8;

  // Get max number of tasks per group from TagStore settings
  const maxNumberOfUserAssistantTask =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfUserAssistantTask"
    ) as number) || 8;

  // Up to maxNumberOfUserAssistantTaskGroup TaskGroups, each up to maxNumberOfUserAssistantTask AssistantTasks
  for (let gIdx = 0; gIdx < maxNumberOfUserAssistantTaskGroup; gIdx++) {
    const group = atq.groups?.[gIdx];
    const groupNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.assistantTaskQuery.toMachine.taskGroup[${gIdx}].no`
    );
    const groupNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.assistantTaskQuery.toMachine.taskGroup[${gIdx}].name`
    );
    if (group && groupNoTag) {
      vals.push({ id: groupNoTag.id, val: group.no });
    }
    if (group && groupNameTag) {
      vals.push({ id: groupNameTag.id, val: group.name });
    }

    for (let tIdx = 0; tIdx < maxNumberOfUserAssistantTask; tIdx++) {
      const task = group?.tasks?.[tIdx];
      const noTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.assistantTaskQuery.toMachine.taskGroup[${gIdx}].assistantTask[${tIdx}].no`
      );
      const textTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.assistantTaskQuery.toMachine.taskGroup[${gIdx}].assistantTask[${tIdx}].text`
      );
      const priorityTag = tagStoreInstance.getTagDataByTagName(
        `LTA-Data.assistantTaskQuery.toMachine.taskGroup[${gIdx}].assistantTask[${tIdx}].priority`
      );
      if (task && noTag) vals.push({ id: noTag.id, val: task.no });
      if (task && textTag) vals.push({ id: textTag.id, val: task.text });
      if (task && priorityTag)
        vals.push({ id: priorityTag.id, val: task.priority });
    }
  }

  if (vals.length === 0) {
    logger.warn(
      "assistantTaskQuery response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `assistantTaskQuery response published with ${vals.length} values.`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.assistantTaskQuery.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.assistantTaskQuery.command.done' in tagStore. Cannot publish done message."
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
        `Published 'assistantTaskQuery' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish assistantTaskQuery response: ${(err as Error).message}`
    );
  }
}
