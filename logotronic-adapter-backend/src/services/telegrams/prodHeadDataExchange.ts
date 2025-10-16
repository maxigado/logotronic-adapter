// src/service/prodHeadDataExchange.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for prodHeadDataExchange service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for prodHeadDataExchange service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.typeId"
    ) || rapidaTypeIds.prodHeadDataExchange;

  // Job attributes
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.orderNo"
    ) || "";
  const partOrderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.partOrderNo"
    ) || "";
  const partOrderName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.partOrderName"
    ) || "";
  const printStandardFront =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.printStandardFront"
    ) || "";
  const printStandardBack =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.printStandardBack"
    ) || "";

  // Delivery attributes
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.delivery.amount"
    ) || "0";
  const date =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.delivery.date"
    ) || Date.now().toString();

  // Paper attributes
  const paperNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.paper.paperNo"
    ) || "";
  const printWidth =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.paper.printWidth"
    ) || "0";
  const printHeight =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.paper.printHeight"
    ) || "0";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" partOrderNo="${partOrderNo}" partOrderName="${partOrderName}" printStandardFront="${printStandardFront}" printStandardBack="${printStandardBack}"/>
  <Delivery amount="${amount}" date="${date}" />
  <Paper paperNo="${paperNo}" printWidth="${printWidth}" printHeight="${printHeight}"/>
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
      `prodHeadDataExchange request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send prodHeadDataExchange request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for prodHeadDataExchange service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
