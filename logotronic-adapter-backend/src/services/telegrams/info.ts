// src/service/info.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { rapidaTypeIds } from "../../dataset/typeid";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for info service");

  const typeId = rapidaTypeIds.info;

  // Mock Inputs
  const workplaceName = "RA162-4"; // char / 30+1
  const workplaceType = "DM"; // char / 10+1
  const workplaceDataLength = 5; // unsigned long
  const workplaceData = 0; // unsigned char

  // Create binary body
  const bodyBuffer = Buffer.alloc(47); // 31 + 11 + 4 + 1

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
  bodyBuffer.writeUInt8(workplaceData, offset);

  const requestBuffer = createLogotronicRequestFrame(bodyBuffer, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`info request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send info request.");
  }
}

export function logotronicResponseHandler(binaryResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for info service with response: ${binaryResponse}`
  );
}
