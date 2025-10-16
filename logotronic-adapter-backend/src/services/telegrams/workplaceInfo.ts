// src/service/workplaceInfo.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for workplaceInfo service");

  const typeId = rapidaTypeIds.workplaceInfo;

  // This is a header-only request, so the body is an empty buffer.
  const bodyBuffer = Buffer.alloc(0);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    // Per user instruction, sending only the first 24 bytes, deviating from the protocol.
    const slicedBuffer = requestBuffer.slice(0, 24);
    tcpClientInstance.send(slicedBuffer);
    logger.info(`workplaceInfo request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send workplaceInfo request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for workplaceInfo service with response: ${xmlResponse}`
  );
}
