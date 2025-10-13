// src/service/assistantTask.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for assistantTask service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for assistantTask service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.typeId"
    ) || rapidaTypeIds.assistantTask;

  const no =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.assistantTask.no"
    ) || "";
  const priority =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.assistantTask.priority"
    ) || "";
  const comment =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.assistantTask.toServer.assistantTask.comment"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <AssistantTask no="${no}" priority="${priority}" comment="${comment}" />
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`assistantTask request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send assistantTask request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for assistantTask service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
