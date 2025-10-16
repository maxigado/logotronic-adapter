// src/service/deleteJob.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for deleteJob service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.deleteJob.toServer.typeId") ||
    rapidaTypeIds.deleteJob;

  const orderNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.deleteJob.toServer.order.number"
    ) || "";
  const partOrderNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.deleteJob.toServer.partOrder.number"
    ) || "";
  const jobNumber =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.deleteJob.toServer.job.number"
    ) || "";

  const serviceXml = `
<Request typeId="${typeId}">
<Order number="${orderNumber}" />
<Job number="${jobNumber}" />
<PartOrder number="${partOrderNumber}" />
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`deleteJob request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send deleteJob request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for deleteJob service with response: ${xmlResponse}`
  );
}
