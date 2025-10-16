// src/service/disconnect.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for disconnect service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.disconnect.toServer.typeId") ||
    rapidaTypeIds.disconnect;

  const timeStamp =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.disconnect.toServer.disconnect.timeStamp"
    ) || Date.now();
  const reason =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.disconnect.toServer.disconnect.reason"
    ) || "0";

  const serviceXml = `
<Request typeId="${typeId}" >
<Disconnect timeStamp="${timeStamp}" reason="${reason}" />
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`disconnect request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send disconnect request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for disconnect service with response: ${xmlResponse}`
  );
}
