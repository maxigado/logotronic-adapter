// src/service/userEvent.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for userEvent service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for userEvent service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.userEvent.toServer.typeId") ||
    rapidaTypeIds.userEvent;

  const id =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.id"
    ) || "";
  const incoming =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.incoming"
    ) || "";
  const outgoing =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.outgoing"
    ) || "";
  const comment =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.comment"
    ) || "";
  const rebook =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.userEvent.toServer.userMessage.rebook"
    ) || "false";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Usermessage id="${id}" incoming="${incoming}" outgoing="${outgoing}" comment="${comment}" rebook="${rebook}" />
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`userEvent request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send userEvent request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for userEvent service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
