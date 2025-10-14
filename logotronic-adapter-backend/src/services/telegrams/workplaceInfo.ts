// src/service/workplaceInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for workplaceInfo service.
 * This service requests information about the workplace and has no payload.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for workplaceInfo service");

  const typeId = rapidaTypeIds.workplaceInfo; // This is a fixed Type ID

  try {
    // This request has no payload, so we pass an empty Buffer.
    const payload = Buffer.alloc(0);

    // Create the full request frame
    const requestBuffer = createLogotronicRequestFrame(payload, {
      requestType: Number(typeId),
    });

    // Send over TCP
    if (tcpClientInstance && tcpClientInstance.isConnected) {
      tcpClientInstance.send(requestBuffer);
      logger.info(
        `workplaceInfo request (TypeID: ${typeId}) sent successfully.`
      );
    } else {
      logger.error(
        "TCP Client is not connected. Cannot send workplaceInfo request."
      );
    }
  } catch (error) {
    logger.error(
      `Error constructing workplaceInfo request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for workplaceInfo service with response: ${xmlResponse}`
  );
  // This is likely a binary response, not XML. Handling needs to be adjusted.
}
