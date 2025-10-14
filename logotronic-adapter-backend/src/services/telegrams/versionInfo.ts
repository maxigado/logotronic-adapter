// src/service/versionInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for versionInfo service.
 * This service sends client version information as a binary payload.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for versionInfo service");

  const typeId = rapidaTypeIds.versionInfo; // This is a fixed Type ID

  try {
    // Read inputs from tagStore
    const protocolVersion =
      String(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.versionInfo.toServer.protocolVersion"
        )
      ) || "0.0.0.0";
    const clientVersion =
      String(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.versionInfo.toServer.clientVersion"
        )
      ) || "0.0.0.0";
    const clientRevision =
      String(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.versionInfo.toServer.clientRevision"
        )
      ) || "0.0.0.0";

    // --- Construct the binary payload ---
    // Each version string is 32 bytes, null-padded
    const protocolVersionBuffer = Buffer.alloc(32);
    protocolVersionBuffer.write(protocolVersion, "utf-8");

    const clientVersionBuffer = Buffer.alloc(32);
    clientVersionBuffer.write(clientVersion, "utf-8");

    const clientRevisionBuffer = Buffer.alloc(32);
    clientRevisionBuffer.write(clientRevision, "utf-8");

    // Concatenate all parts to form the payload
    const payload = Buffer.concat([
      protocolVersionBuffer,
      clientVersionBuffer,
      clientRevisionBuffer,
    ]);

    // Create the full request frame
    const requestBuffer = createLogotronicRequestFrame(payload, {
      requestType: Number(typeId),
    });

    // Send over TCP
    if (tcpClientInstance && tcpClientInstance.isConnected) {
      tcpClientInstance.send(requestBuffer);
      logger.info(`versionInfo request (TypeID: ${typeId}) sent successfully.`);
    } else {
      logger.error(
        "TCP Client is not connected. Cannot send versionInfo request."
      );
    }
  } catch (error) {
    logger.error(
      `Error constructing versionInfo request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for versionInfo service with response: ${xmlResponse}`
  );
  // This is likely a binary response, not XML. Handling needs to be adjusted.
}
