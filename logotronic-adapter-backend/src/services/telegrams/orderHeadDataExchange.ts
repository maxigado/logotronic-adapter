// src/service/orderHeadDataExchange.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for orderHeadDataExchange service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for orderHeadDataExchange service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.typeId"
    ) || rapidaTypeIds.orderHeadDataExchange;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.job.orderNo"
    ) || "";
  const orderName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.job.orderName"
    ) || "";
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.delivery.amount"
    ) || "0";
  const date =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.delivery.date"
    ) || Date.now().toString();
  const customerNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.customer.customerNo"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" orderName="${orderName}"/>
  <Delivery amount="${amount}" date="${date}" />
  <Customer customerNo="${customerNo}" />
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
      `orderHeadDataExchange request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send orderHeadDataExchange request."
    );
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for orderHeadDataExchange service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
