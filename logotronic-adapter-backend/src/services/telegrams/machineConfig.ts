// src/service/machineConfig.ts
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
 * Logotronic Request Builder for machineConfig service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for machineConfig service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.typeId"
    ) || rapidaTypeIds.machineConfig;

  // Get machine information from tags
  const machineVersion =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.machine.version"
    ) || "";
  const serialNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.machine.serialNumber"
    ) || "";
  const machineType =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.machine.machineType"
    ) || "";

  // Get sheet sizes
  const lengthMin =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.sheetSizes.length.min"
    ) || 0;
  const lengthMax =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.sheetSizes.length.max"
    ) || 0;
  const widthMin =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.sheetSizes.width.min"
    ) || 0;
  const widthMax =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.sheetSizes.width.max"
    ) || 0;
  const thicknessMin =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.sheetSizes.thickness.min"
    ) || 0;
  const thicknessMax =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineConfig.toServer.sheetSizes.thickness.max"
    ) || 0;

  // Get units (0-6)
  const units = [];
  for (let i = 0; i <= 6; i++) {
    const unitNumber =
      (tagStoreInstance.getValueByTagName(
        `LTA-Data.machineConfig.toServer.unit.unit[${i}].number`
      ) as number) || 0;
    const unitType =
      (tagStoreInstance.getValueByTagName(
        `LTA-Data.machineConfig.toServer.unit.unit[${i}].unitType`
      ) as string) || "";

    // Only add units that have a number > 0 or a non-empty unitType
    if (unitNumber > 0 || unitType !== "") {
      units.push({
        number: unitNumber,
        unitType: unitType,
      });
    }
  }

  // Build the XML request
  let serviceXml = `<Request typeId="${typeId}">
    <Machine version="${machineVersion}" serialNumber="${serialNumber}" machineType="${machineType}"/>
    <SheetSizes>
        <Length min="${lengthMin}" max="${lengthMax}" />
        <Width min="${widthMin}" max="${widthMax}"/>
        <Thickness min="${thicknessMin}" max="${thicknessMax}"/>
    </SheetSizes>`;

  // Add units
  for (const unit of units) {
    serviceXml += `
    <Unit number="${unit.number}" unitType="${unit.unitType}"/>`;
  }

  serviceXml += `
</Request>`;

  logger.debug(`machineConfig XML Request: ${serviceXml}`);

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`machineConfig request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machineConfig request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("machineConfig response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`machineConfig raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("machineConfig response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== 10200) {
      logger.error(
        `machineConfig response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any;

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineConfig.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.machineConfig.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineConfig.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.machineConfig.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.machineConfig.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.machineConfig.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "machineConfig response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `machineConfig response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.machineConfig.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.machineConfig.command.done' in tagStore. Cannot publish done message."
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

        mqttClientInstance.publish(topic, doneMqttMessage as any);
        logger.info(
          `Published 'machineConfig' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish machineConfig response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in machineConfig logotronicResponseHandler: ${err}`
    );
  }
}
