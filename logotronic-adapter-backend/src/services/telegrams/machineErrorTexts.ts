// src/services/telegrams/machineErrorTexts.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";
import * as fs from "fs";
import * as path from "path";

/**
 * Language ID to XML file mapping.
 * Maps language IDs to their corresponding error text XML files.
 * If a language file is not found, the default English (GB) file is used.
 * The default file is always available as it's bundled with the application.
 */
const LANGUAGE_ID_TO_FILE_MAP: { [key: number]: string } = {
  0: "MessagesAndLocations_de.xml", // German
  1: "MessagesAndLocations_en_gb.xml", // English (GB) - Default (always available)
  2: "MessagesAndLocations_fr.xml", // French
  3: "MessagesAndLocations_it.xml", // Italian
  4: "MessagesAndLocations_hu.xml", // Hungary
  5: "MessagesAndLocations_es.xml", // Spain
  6: "MessagesAndLocations_sv.xml", // Swedish
  7: "MessagesAndLocations_da.xml", // Danish
  8: "MessagesAndLocations_en_us.xml", // English (US)
  9: "MessagesAndLocations_nl.xml", // Dutch
  10: "MessagesAndLocations_pt.xml", // Portuguese
  11: "MessagesAndLocations_pl.xml", // Polish
  12: "MessagesAndLocations_ru.xml", // Russian
  13: "MessagesAndLocations_el.xml", // Greek
  14: "MessagesAndLocations_zh.xml", // Chinese
  15: "MessagesAndLocations_cs.xml", // Czech
  16: "MessagesAndLocations_ko.xml", // Korean
  17: "MessagesAndLocations_tr.xml", // Turkish
  18: "MessagesAndLocations_hr.xml", // Croatian
  19: "MessagesAndLocations_fi.xml", // Finnish
  21: "MessagesAndLocations_ja.xml", // Japanese
  22: "MessagesAndLocations_sk.xml", // Sloveccia
  23: "MessagesAndLocations_ro.xml", // Romanian
  24: "MessagesAndLocations_vi.xml", // Vietnamese
  25: "MessagesAndLocations_ar.xml", // Arabic
  26: "MessagesAndLocations_th.xml", // Thai
  27: "MessagesAndLocations_sl.xml", // Slovenian
  28: "MessagesAndLocations_zh_tw.xml", // Chinese (Traditional)
  29: "MessagesAndLocations_he.xml", // Hebrew
  30: "MessagesAndLocations_lt.xml", // Lithuanian
  31: "MessagesAndLocations_pt_br.xml", // Portuguese (Brasil)
  32: "MessagesAndLocations_bg.xml", // Bulgarian
  33: "MessagesAndLocations_et.xml", // Estonian
  34: "MessagesAndLocations_lv.xml", // Latvian
  35: "MessagesAndLocations_no.xml", // Norwegian
  36: "MessagesAndLocations_fa.xml", // Farsi
};

const DEFAULT_LANGUAGE_ID = 1; // English (GB)
const DEFAULT_XML_FILE = "MessagesAndLocations_en_gb.xml";

/**
 * Reads the error text XML file for the given language ID.
 * Strips the XML declaration line and returns the content.
 * Falls back to English (GB) default file if:
 * - The language ID is not mapped
 * - The requested file doesn't exist
 * - GitHub sync failed and only default file is available
 */
function getErrorTextXmlContent(languageId: number): string {
  // Get the filename for the language, or use default if language ID not mapped
  const fileName = LANGUAGE_ID_TO_FILE_MAP[languageId];
  if (!fileName) {
    logger.warn(
      `Language ID ${languageId} not found in mapping. Using default: ${DEFAULT_XML_FILE}`
    );
    return loadDefaultErrorTextFile();
  }

  const filePath = path.join(__dirname, "../../errortexts", fileName);

  try {
    // Check if the requested file exists
    if (!fs.existsSync(filePath)) {
      logger.warn(
        `Error text XML file not found for languageId ${languageId}: ${fileName}. Using default: ${DEFAULT_XML_FILE}`
      );
      return loadDefaultErrorTextFile();
    }

    const content = fs.readFileSync(filePath, "utf8");
    logger.info(
      `Successfully loaded error text XML for languageId ${languageId}: ${fileName}`
    );
    return stripXmlDeclaration(content);
  } catch (error) {
    logger.error(
      `Error reading error text XML file ${fileName}: ${error}. Using default: ${DEFAULT_XML_FILE}`
    );
    return loadDefaultErrorTextFile();
  }
}

/**
 * Loads the default error text XML file.
 * This file is always bundled with the application and serves as a fallback.
 */
function loadDefaultErrorTextFile(): string {
  try {
    const defaultPath = path.join(
      __dirname,
      "../../errortexts",
      DEFAULT_XML_FILE
    );
    const content = fs.readFileSync(defaultPath, "utf8");
    logger.info(`Using default error text file: ${DEFAULT_XML_FILE}`);
    return stripXmlDeclaration(content);
  } catch (error) {
    logger.error(
      `Critical: Could not read default error text XML file: ${error}`
    );
    // Return minimal valid XML structure as last resort
    return '<MessagesAndLocations languageId="1"><Locations></Locations><Messages></Messages></MessagesAndLocations>';
  }
}

/**
 * Strips the XML declaration line from the XML content.
 * Removes "<?xml version='1.0' encoding='UTF-8'?>" and any surrounding whitespace.
 */
function stripXmlDeclaration(xmlContent: string): string {
  return xmlContent.replace(/<\?xml[^?]*\?>\s*/i, "").trim();
}

/**
 * Logotronic Request Builder for machineErrorTexts service.
 * Sends machine error location and message definitions to the server.
 * Builds request XML with locations array (up to 2) and messages array (up to 2).
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for machineErrorTexts service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineErrorText.toServer.typeId"
    ) || rapidaTypeIds.machineErrorTexts;

  const languageIdValue = tagStoreInstance.getValueByTagName(
    "LTA-Data.machineErrorText.toServer.messagesAndLocations.languageId"
  );

  // Parse languageId, default to 1 (English GB) if not provided or invalid
  let languageId = DEFAULT_LANGUAGE_ID;
  if (
    languageIdValue !== undefined &&
    languageIdValue !== null &&
    languageIdValue !== ""
  ) {
    const parsedId = parseInt(languageIdValue.toString(), 10);
    if (!isNaN(parsedId)) {
      languageId = parsedId;
    }
  }

  logger.info(`machineErrorTexts using languageId: ${languageId}`);

  // Get the error text XML content based on languageId
  const errorTextXml = getErrorTextXmlContent(languageId);

  // Construct the full XML request with embedded error text XML
  const serviceXml = `
<Request typeId="${typeId}">
${errorTextXml}
</Request>
`;

  // Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `machineErrorTexts request (TypeID: ${typeId}, LanguageID: ${languageId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machineErrorTexts request."
    );
  }
}

/**
 * Logotronic Response Handler for machineErrorTexts service.
 * Processes the response containing only meta fields (typeId, returnCode, errorReason).
 * No domain-specific data in response body.
 */
export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("machineErrorTexts response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`machineErrorTexts raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("machineErrorTexts response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    const expectedTypeId = Number(rapidaTypeIds.machineErrorTexts);
    if (!domain || (domain as any).typeId !== expectedTypeId) {
      logger.error(
        `machineErrorTexts response domain parsing failed or typeId mismatch. Parsed typeId: ${
          (domain as any)?.typeId
        }, expected: ${expectedTypeId}`
      );
      return;
    }

    // Cast to MachineErrorTextsResponse (contains only meta fields)
    const { typeId, returnCode, errorReason } = domain as any;

    // Get tag IDs for meta fields
    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineErrorText.toMachine.typeId"
    );
    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineErrorText.toMachine.returnCode"
    );
    const errorReasonTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.machineErrorText.toMachine.errorReason"
    );

    if (!typeIdTag || !returnCodeTag) {
      logger.error(
        "machineErrorTexts response missing required meta tag IDs; aborting publish."
      );
      return;
    }

    const vals: { id: string; val: string | number | boolean }[] = [
      { id: typeIdTag.id, val: typeId },
      { id: returnCodeTag.id, val: returnCode },
    ];

    // Include errorReason ONLY if returnCode is not 1
    if (returnCode !== 1 && errorReasonTag && errorReason !== undefined) {
      vals.push({ id: errorReasonTag.id, val: errorReason });
    }

    if (vals.length === 0) {
      logger.warn(
        "machineErrorTexts response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `machineErrorTexts response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.machineErrorText.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.machineErrorText.command.done' in tagStore. Cannot publish done message."
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
          `Published 'machineErrorTexts' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish machineErrorTexts response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in machineErrorTexts logotronicResponseHandler: ${err}`
    );
  }
}
