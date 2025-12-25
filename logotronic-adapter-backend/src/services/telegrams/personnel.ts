// src/service/personnel.ts
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
 * Logotronic Request Builder for personnel service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for personnel service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.personnel.toServer.typeId") ||
    rapidaTypeIds.personnel;

  const id =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.personnel.toServer.personal.id"
    ) || "";
  const firstName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.personnel.toServer.personal.firstName"
    ) || "";
  const lastName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.personnel.toServer.personal.lastName"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Personal id="${id}" firstName="${firstName}" lastName="${lastName}"/>
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`personnel request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send personnel request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn("personnel response handler received empty buffer; ignoring.");
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for personnel service with response: ${xmlResponse}`
  );

  // Parse XML safely
  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error("personnel response handler could not parse XML; aborting.");
    return;
  }

  // Use registry to obtain domain-specific parsed response
  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "personnel response handler could not extract meta/domain; aborting."
    );
    return;
  }

  // Validate typeId
  const expectedTypeId = parseInt(rapidaTypeIds.personnel, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `personnel response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const personnelDomain = domain as any; // has people[] from parser

  // Retrieve meta tag IDs (need tag objects, not current values)
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.personnel.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.personnel.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.personnel.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "personnel response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  // Include errorReason ONLY if returnCode is 0 or -1 (per spec)
  if (
    (domain.returnCode === 0 || domain.returnCode === -1) &&
    errorReasonTag &&
    personnelDomain.errorReason !== undefined
  ) {
    vals.push({ id: errorReasonTag.id, val: personnelDomain.errorReason });
  }

  // Get max number of personnel from TagStore settings
  const maxNumberOfPersonnel =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfPersonnel"
    ) as number) || 16;

  // Up to maxNumberOfPersonnel Personal entries
  for (let pIdx = 0; pIdx < maxNumberOfPersonnel; pIdx++) {
    const person = personnelDomain.people?.[pIdx];
    if (!person) break; // stop when no more entries

    const internalIdTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].internalId`
    );
    const idTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].id`
    );
    const firstNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].firstName`
    );
    const lastNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].lastName`
    );
    const jobTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].job`
    );
    const passwordTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].password`
    );
    const loginAsTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].loginAs`
    );
    const loginTimeTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].loginTime`
    );
    const loginWorkplaceIdTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].loginWorkplaceId`
    );
    const breakTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].break`
    );
    const jpegDataTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.personnel.toMachine.personal[${pIdx}].JPEGData`
    );

    if (internalIdTag && person.internalId !== undefined)
      vals.push({ id: internalIdTag.id, val: person.internalId });
    if (idTag && person.id !== undefined)
      vals.push({ id: idTag.id, val: person.id });
    if (firstNameTag && person.firstName !== undefined)
      vals.push({ id: firstNameTag.id, val: person.firstName });
    if (lastNameTag && person.lastName !== undefined)
      vals.push({ id: lastNameTag.id, val: person.lastName });
    if (jobTag && person.job !== undefined)
      vals.push({ id: jobTag.id, val: person.job });
    if (passwordTag && person.password !== undefined)
      vals.push({ id: passwordTag.id, val: person.password });
    if (loginAsTag && person.loginAs !== undefined)
      vals.push({ id: loginAsTag.id, val: person.loginAs });
    if (loginTimeTag && person.loginTime !== undefined)
      vals.push({ id: loginTimeTag.id, val: person.loginTime });
    if (loginWorkplaceIdTag && person.loginWorkplaceId !== undefined)
      vals.push({ id: loginWorkplaceIdTag.id, val: person.loginWorkplaceId });
    // Map pause attribute from XML to break tag
    if (breakTag && person.pause !== undefined)
      vals.push({ id: breakTag.id, val: person.pause });
    if (jpegDataTag && person.jpegDataBase64 !== undefined)
      vals.push({ id: jpegDataTag.id, val: person.jpegDataBase64 });
  }

  if (vals.length === 0) {
    logger.warn(
      "personnel response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `personnel response published with ${vals.length} values (including ${
        personnelDomain.people?.length || 0
      } personnel entries).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.personnel.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.personnel.command.done' in tagStore. Cannot publish done message."
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
        `Published 'personnel' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish personnel response: ${(err as Error).message}`
    );
  }
}
