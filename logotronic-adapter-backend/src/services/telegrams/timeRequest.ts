// src/service/timeRequest.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for timeRequest service");

  const typeId = rapidaTypeIds.timeRequest;

  // This is a header-only request, so the body is an empty buffer.
  const bodyBuffer = Buffer.alloc(0);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    // Per user instruction, sending only the first 24 bytes, deviating from the protocol.
    const slicedBuffer = requestBuffer.slice(0, 24);
    tcpClientInstance.send(slicedBuffer);
    logger.info(`timeRequest request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send timeRequest request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for timeRequest service with response: ${xmlResponse}`
  );
}
