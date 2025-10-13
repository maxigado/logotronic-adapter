// src/service/readRepetitionData.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for readRepetitionData service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for readRepetitionData service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.typeId"
    ) || rapidaTypeIds.readRepetitionData;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.job.orderNo"
    ) || "x";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.job.prodNo"
    ) || "y";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.job.jobNo"
    ) || "z";
  const identifier =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.readRepetitionData.toServer.readRepetitionData.identifier"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
  <ReadRepetitionData identifier="${identifier}"/>
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
      `readRepetitionData request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send readRepetitionData request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for readRepetitionData service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
