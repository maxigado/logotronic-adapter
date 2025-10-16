// src/service/createChangePersonnel.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for createChangePersonnel service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for createChangePersonnel service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.typeId"
    ) || rapidaTypeIds.createChangePersonnel;

  const internalId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.internalId"
    ) || "";
  const id =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.id"
    ) || "";
  const firstName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.firstName"
    ) || "";
  const lastName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.lastName"
    ) || "";
  const job =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.job"
    ) || "";
  const password =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createChangePersonnel.toServer.personal.password"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Personal internalId="${internalId}" id="${id}" firstName="${firstName}" lastName="${lastName}" job="${job}" password="${password}" />
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
      `createChangePersonnel request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send createChangePersonnel request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for createChangePersonnel service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
