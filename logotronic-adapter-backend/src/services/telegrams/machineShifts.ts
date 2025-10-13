// src/service/machineShifts.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for machineShifts service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for machineShifts service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machineShifts.toServer.typeId"
    ) || rapidaTypeIds.machineShifts;

  // 1. Telegram's XML body is simple for this request
  const serviceXml = `<Request typeId="${typeId}"/>`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`machineShifts request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machineShifts request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for machineShifts service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
