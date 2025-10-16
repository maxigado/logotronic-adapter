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

export function logotronicResponseHandler(responseBody: Buffer) {
  logger.info(
    `Logotronic Response Handler is called for workplaceInfo service`
  );
  // Binary response, not XML
  let offset = 0;

  const workplaceName = responseBody
    .toString("utf8", offset, offset + 31)
    .trim();
  offset += 31;

  const workplaceType = responseBody
    .toString("utf8", offset, offset + 11)
    .trim();
  offset += 11;

  const workplaceDataLength = responseBody.readUInt32BE(offset);
  offset += 4;

  const workplaceData = responseBody.slice(
    offset,
    offset + workplaceDataLength
  );

  logger.info(
    `WorkplaceName: ${workplaceName}, WorkplaceType: ${workplaceType}, DataLength: ${workplaceDataLength}`
  );

  // TODO: Update tags in the tag store
}
