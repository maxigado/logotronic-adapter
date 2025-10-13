// src/service/getOrderNote.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for getOrderNote service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.typeId"
    ) || rapidaTypeIds.getOrderNote;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.job.prodNo"
    ) || "";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.getOrderNote.toServer.job.jobNo"
    ) || "";

  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`getOrderNote request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send getOrderNote request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for getOrderNote service with response: ${xmlResponse}`
  );
}
