// src/service/accept.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for accept service");

  const typeId = rapidaTypeIds.accept;

  // Mock Inputs
  const currentIndex = 8; // unsigned short
  const maxConnection = 64; // unsigned short
  const serverInfo = "1.0.3.9"; // char / 255 + 1

  // Create binary body
  const bodyBuffer = Buffer.alloc(260); // 2 + 2 + 256

  let offset = 0;
  bodyBuffer.writeUInt16BE(currentIndex, offset);
  offset += 2;

  bodyBuffer.writeUInt16BE(maxConnection, offset);
  offset += 2;

  // Write serverInfo and fill the rest with null characters
  const serverInfoBuffer = Buffer.from(serverInfo, "ascii");
  serverInfoBuffer.copy(bodyBuffer, offset);
  // Fill the rest of the 256 bytes with null characters
  bodyBuffer.fill(0, offset + serverInfoBuffer.length, offset + 256);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    // Using a placeholder for requestType as "ACCEPT" is not a number.
    // This is for testing purposes as requested by the user.
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`accept request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send accept request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for accept service with response: ${xmlResponse}`
  );
}
