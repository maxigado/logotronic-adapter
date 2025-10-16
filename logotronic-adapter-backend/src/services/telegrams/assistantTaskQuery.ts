// src/service/assistantTask.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for assistantTaskQuery service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for assistantTaskQuery service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTaskQuery.toServer.typeId"
    ) || rapidaTypeIds.assistantTaskQuery;

  const languageId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTaskQuery.toServer.assistantTask.languageId"
    ) || "1";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <AssistantTasks languageId="${languageId}" />
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
      `assistantTaskQuery request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send assistantTaskQuery request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for assistantTaskQuery service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
