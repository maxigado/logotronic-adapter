// src/service/setOrderNote.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for setOrderNote service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.typeId"
    ) || rapidaTypeIds.setOrderNote;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.job.prodNo"
    ) || "";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.job.jobNo"
    ) || "";
  const orderNote =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.orderNote"
    ) || "Attention printer! This is an important comment";

  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
<OrderNote>${orderNote}</OrderNote>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`setOrderNote request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send setOrderNote request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for setOrderNote service with response: ${xmlResponse}`
  );
}
