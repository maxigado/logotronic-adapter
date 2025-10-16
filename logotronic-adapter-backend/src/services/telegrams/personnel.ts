// src/service/personnel.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for personnel service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for personnel service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.personnel.toServer.typeId") ||
    rapidaTypeIds.personnel;

  const id =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.personnel.toServer.personal.id"
    ) || "";
  const firstName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.personnel.toServer.personal.firstName"
    ) || "";
  const lastName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.personnel.toServer.personal.lastName"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Personal id="${id}" firstName="${firstName}" lastName="${lastName}"/>
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`personnel request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send personnel request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for personnel service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
