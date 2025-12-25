// src/services/telegrams/activeAssistantTasks.ts
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
 * Logotronic Request Builder for activeAssistantTasks service.
 * Sends a request to retrieve currently active assistant tasks.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for activeAssistantTasks service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.activeAssistantTasks.toServer.typeId"
    ) || rapidaTypeIds.activeAssistantTasks;

  const languageId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.activeAssistantTasks.toServer.activeAssistantTasks.languageId"
    ) || "1";

  // 1. Construct the XML body for the telegram
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
      `activeAssistantTasks request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send activeAssistantTasks request."
    );
  }
}

/**
 * Logotronic Response Handler for activeAssistantTasks service.
 * Processes the response containing active assistant tasks and publishes to MQTT.
 */
export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "activeAssistantTasks response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for activeAssistantTasks service with response: ${xmlResponse}`
  );

  // Parse XML safely
  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "activeAssistantTasks response handler could not parse XML; aborting."
    );
    return;
  }

  // Use registry to obtain domain-specific parsed response
  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "activeAssistantTasks response handler could not extract meta/domain; aborting."
    );
    return;
  }

  // Validate typeId (strict validation like personnel and jobHeadDataExchange)
  const expectedTypeId = parseInt(rapidaTypeIds.activeAssistantTasks, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `activeAssistantTasks response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const activeTasksDomain = domain as any; // cast to parsed response type

  // Retrieve meta tag IDs
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.activeAssistantTasks.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.activeAssistantTasks.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.activeAssistantTasks.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "activeAssistantTasks response missing required meta tag IDs; aborting publish."
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

  // Get max number of active assistant tasks from TagStore settings
  const maxNumberOfUserActiveAssistantTasks =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfUserActiveAssistantTasks"
    ) as number) || 16;

  // Iterate through up to maxNumberOfUserActiveAssistantTasks assistant tasks
  for (let idx = 0; idx < maxNumberOfUserActiveAssistantTasks; idx++) {
    const task = activeTasksDomain.tasks?.[idx];
    if (!task) break; // Stop when no more tasks

    // Required attributes
    const noTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].no`
    );
    const textTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].text`
    );
    const priorityTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].priority`
    );
    const kindTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].kind`
    );
    const groupNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].groupNo`
    );

    // Optional attributes
    const workingTaskIdTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].workingTaskId`
    );
    const parameterTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].parameter`
    );
    const commentTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.activeAssistantTasks.toMachine.assistantTask[${idx}].comment`
    );

    // Push required attributes
    if (noTag && task.no !== undefined)
      vals.push({ id: noTag.id, val: task.no });
    if (textTag && task.text !== undefined)
      vals.push({ id: textTag.id, val: task.text });
    if (priorityTag && task.priority !== undefined)
      vals.push({ id: priorityTag.id, val: task.priority });
    if (kindTag && task.kind !== undefined)
      vals.push({ id: kindTag.id, val: task.kind });
    if (groupNoTag && task.groupNo !== undefined)
      vals.push({ id: groupNoTag.id, val: task.groupNo });

    // Push optional attributes only if they exist in the parsed task
    if (workingTaskIdTag && task.workingTaskId !== undefined)
      vals.push({ id: workingTaskIdTag.id, val: task.workingTaskId });
    if (parameterTag && task.parameter !== undefined)
      vals.push({ id: parameterTag.id, val: task.parameter });
    if (commentTag && task.comment !== undefined)
      vals.push({ id: commentTag.id, val: task.comment });
  }

  if (vals.length === 0) {
    logger.warn(
      "activeAssistantTasks response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `activeAssistantTasks response published with ${
        vals.length
      } values (including ${activeTasksDomain.tasks?.length || 0} tasks).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.activeAssistantTasks.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.activeAssistantTasks.command.done' in tagStore. Cannot publish done message."
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
        `Published 'activeAssistantTasks' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish activeAssistantTasks response: ${
        (err as Error).message
      }`
    );
  }
}
