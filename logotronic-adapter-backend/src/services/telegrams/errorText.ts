// src/service/errorText.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for errorText service.
 * This service sends an error message as a binary payload.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for errorText service");

  const typeId = rapidaTypeIds.errorText; // This is a fixed Type ID

  try {
    // Read input from tagStore
    const message =
      String(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.errorText.toServer.message"
        )
      ) || "An unknown error occurred.";

    // The payload is the UTF-8 encoded message string.
    const payload = Buffer.from(message, "utf-8");

    // Create the full request frame
    const requestBuffer = createLogotronicRequestFrame(payload, {
      requestType: Number(typeId),
    });

    // Send over TCP
    if (tcpClientInstance && tcpClientInstance.isConnected) {
      tcpClientInstance.send(requestBuffer);
      logger.info(`errorText request (TypeID: ${typeId}) sent successfully.`);
    } else {
      logger.error(
        "TCP Client is not connected. Cannot send errorText request."
      );
    }
  } catch (error) {
    logger.error(
      `Error constructing errorText request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for errorText service with response: ${xmlResponse}`
  );
  // This is likely a binary response, not XML. Handling needs to be adjusted.
}
