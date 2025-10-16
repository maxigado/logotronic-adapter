// src/service/workplaceSetup.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for workplaceSetup service"
  );

  const typeId = rapidaTypeIds.workplaceSetup;

  // Get values from tagStore
  const workplaceName =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceName"
    ) as string) || "";
  const workplaceType =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceType"
    ) as string) || "";
  const workplaceDataLength =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceDataLength"
    ) as number) || 0;
  const workplaceData =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.workplaceSetup.toServer.workplaceData"
    ) as number) || 0;

  // Create binary body
  const bodyBuffer = Buffer.alloc(46 + workplaceDataLength);

  let offset = 0;

  // Write workplaceName and fill with null characters
  const workplaceNameBuffer = Buffer.from(workplaceName, "ascii");
  workplaceNameBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + workplaceNameBuffer.length, offset + 31);
  offset += 31;

  // Write workplaceType and fill with null characters
  const workplaceTypeBuffer = Buffer.from(workplaceType, "ascii");
  workplaceTypeBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + workplaceTypeBuffer.length, offset + 11);
  offset += 11;

  // Write workplaceDataLength
  bodyBuffer.writeUInt32BE(workplaceDataLength, offset);
  offset += 4;

  // Write workplaceData
  // Assuming workplaceData is a single byte for now.
  // If it can be a buffer, this part needs to be adjusted.
  if (workplaceDataLength > 0) {
    bodyBuffer.writeUInt8(workplaceData, offset);
  }

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
    workplaceIDOverride: "", // Empty for WP_SETUP
  });

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
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for workplaceSetup service with response: ${xmlResponse}`
  );
}
