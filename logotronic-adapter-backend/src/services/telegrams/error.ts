// src/service/error.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for error service");

  const typeId = rapidaTypeIds.error;

  // Mock Inputs
  const serverInfo = "This is an error message for test purpose."; // char / 255 + 1

  // Create binary body
  const bodyBuffer = Buffer.alloc(256);

  let offset = 0;

  // Write serverInfo and fill the rest with null characters
  const serverInfoBuffer = Buffer.from(serverInfo, "ascii");
  serverInfoBuffer.copy(bodyBuffer, offset);
  bodyBuffer.fill(0, offset + serverInfoBuffer.length, offset + 256);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`error request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send error request.");
  }
}

export function logotronicResponseHandler(binaryResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for error service with response: ${binaryResponse}`
  );
}
