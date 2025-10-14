// src/service/workplaceSetup.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for workplaceSetup service.
 * This service sends binary data for workplace configuration.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for workplaceSetup service"
  );

  const typeId = rapidaTypeIds.workplaceSetup; // This is a fixed Type ID for binary telegrams

  try {
    // Read inputs from tagStore
    const workplaceName =
      String(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.workplaceSetup.toServer.workplaceName"
        )
      ) || "";
    const workplaceType =
      Number(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.workplaceSetup.toServer.workplaceType"
        )
      ) || 0;
    const workplaceDataLength =
      Number(
        tagStoreInstance.getValueByTagName(
          "LTA-Data.workplaceSetup.toServer.workplaceDataLength"
        )
      ) || 0;

    // Collect workplace data from the buffer tags
    const workplaceDataBytes: number[] = [];
    for (let i = 0; i < workplaceDataLength; i++) {
      const byteValue = tagStoreInstance.getValueByTagName(
        `LTA-Data.workplaceSetup.toServer.workplaceData[${i}]`
      );
      if (byteValue === undefined || byteValue === null) {
        logger.warn(
          `workplaceSetup: Missing data at index ${i}. Stopping data collection.`
        );
        break;
      }
      workplaceDataBytes.push(Number(byteValue));
    }
    const workplaceDataBuffer = Buffer.from(workplaceDataBytes);

    // --- Construct the binary payload ---
    // 1. Workplace Name (32 bytes, null-padded)
    const nameBuffer = Buffer.alloc(32);
    nameBuffer.write(workplaceName, "utf-8");

    // 2. Workplace Type (1 byte)
    const typeBuffer = Buffer.alloc(1);
    typeBuffer.writeUInt8(workplaceType, 0);

    // 3. Workplace Data Length (4 bytes, little-endian)
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(workplaceDataBuffer.length, 0);

    // 4. Concatenate all parts to form the payload
    const payload = Buffer.concat([
      nameBuffer,
      typeBuffer,
      lengthBuffer,
      workplaceDataBuffer,
    ]);

    // Create the full request frame
    const requestBuffer = createLogotronicRequestFrame(payload, {
      requestType: Number(typeId),
    });

    // Send over TCP
    if (tcpClientInstance && tcpClientInstance.isConnected) {
      tcpClientInstance.send(requestBuffer);
      logger.info(
        `workplaceSetup request (TypeID: ${typeId}) sent successfully.`
      );
    } else {
      logger.error(
        "TCP Client is not connected. Cannot send workplaceSetup request."
      );
    }
  } catch (error) {
    logger.error(
      `Error constructing workplaceSetup request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for workplaceSetup service with response: ${xmlResponse}`
  );
  // This is likely a binary response, not XML. Handling needs to be adjusted.
}
