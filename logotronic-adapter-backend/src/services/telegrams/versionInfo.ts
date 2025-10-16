// src/service/versionInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for versionInfo service");

  const typeId = rapidaTypeIds.versionInfo;

  // Get values from tagStore
  const protocolVersion =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.versionInfo.toServer.protocolVersion"
    ) as string) || "0";
  const clientVersion =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.versionInfo.toServer.clientVersion"
    ) as string) || "0";
  const clientRevision =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.versionInfo.toServer.clientRevision"
    ) as string) || "0";

  // Create binary body
  const bodyBuffer = Buffer.alloc(51);

  let offset = 0;

  // Write protocolVersion and fill with null characters
  const protocolVersionBuffer = Buffer.from(protocolVersion, "ascii");
  protocolVersionBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + protocolVersionBuffer.length, offset + 17);
  offset += 17;

  // Write clientVersion and fill with null characters
  const clientVersionBuffer = Buffer.from(clientVersion, "ascii");
  clientVersionBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + clientVersionBuffer.length, offset + 17);
  offset += 17;

  // Write clientRevision and fill with null characters
  const clientRevisionBuffer = Buffer.from(clientRevision, "ascii");
  clientRevisionBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + clientRevisionBuffer.length, offset + 17);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`versionInfo request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send versionInfo request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for versionInfo service with response: ${xmlResponse}`
  );
}
