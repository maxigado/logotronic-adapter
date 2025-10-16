// src/service/jobHeadDataExchange.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for jobHeadDataExchange service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for jobHeadDataExchange service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.typeId"
    ) || rapidaTypeIds.jobHeadDataExchange;

  // Job attributes
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.orderNo"
    ) || "";
  const partOrderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.partOrderNo"
    ) || "";
  const printRunNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.printRunNo"
    ) || "";
  const printRunName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.job.printRunName"
    ) || "";

  // Print attributes
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.amount"
    ) || "0";
  const copy =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.copy"
    ) || "0";
  const subsidy =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.subsidy"
    ) || "0";
  const subsidy2 =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.subsidy2"
    ) || "0";
  const plannedDate =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.plannedDate"
    ) || Date.now().toString();
  const setupTime =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.setupTime"
    ) || "0";
  const printTime =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobHeadDataExchange.toServer.print.printTime"
    ) || "0";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" partOrderNo="${partOrderNo}" printRunNo="${printRunNo}" printRunName="${printRunName}"/>
  <Print amount="${amount}" subsidy="${subsidy}" subsidy2="${subsidy2}" copy="${copy}" plannedDate="${plannedDate}" setupTime="${setupTime}" printTime="${printTime}"/>
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
      `jobHeadDataExchange request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send jobHeadDataExchange request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for jobHeadDataExchange service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
