// src/service/preview.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for preview service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.preview.toServer.typeId") ||
    rapidaTypeIds.preview;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.preview.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.preview.toServer.job.prodNo"
    ) || "";
  const side =
    tagStoreInstance.getValueByTagName("LTA-Data.preview.toServer.job.side") ||
    "0";
  const inkCode =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.preview.toServer.job.inkCode"
    ) || "1";

  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" side="${side}" inkCode="${inkCode}"/>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`preview request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send preview request.");
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for preview service with response: ${xmlResponse}`
  );
}
