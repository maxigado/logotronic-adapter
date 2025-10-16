// src/service/userEventsQuery.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for userEventsQuery service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for userEventsQuery service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEventsQuery.toServer.typeId"
    ) || rapidaTypeIds.userEventsQuery;

  const languageId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEventsQuery.toServer.userEvents.languageId"
    ) || "1";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <UserEvents languageId="${languageId}" />
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `userEventsQuery request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send userEventsQuery request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for userEventsQuery service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
