// src/service/jobList.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
// tagStoreInstance artık burada değil, sadece framebuilder'da kullanılıyor
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
/**
 * Logotronic Request Builder for jobList service.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for jobList service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.jobList.toServer.typeId") ||
    rapidaTypeIds.jobList;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobList.toServer.job.orderNo"
    ) || "*";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobList.toServer.job.prodNo"
    ) || "*";
  const jobNo =
    tagStoreInstance.getValueByTagName("LTA-Data.jobList.toServer.job.jobNo") ||
    "*";
  const sameMachineType =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobList.toServer.jobList.sameMachineType"
    ) || "false";
  const max =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobList.toServer.jobList.max"
    ) || "300";
  const plateCheck =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobList.toServer.jobList.plateCheck"
    ) || "0";

  // 1. Telegram'ın XML gövdesini oluştur (Sadece Telegram'a özel kısım).
  const serviceXml = `
<Request typeld="${typeId}">
    <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
    <JobList sameMachineType="${sameMachineType}" max="${max}" plateCheck="${plateCheck}"/>
</Request>
`;

  // 2. İkili (Binary) istek çerçevesini, header bilgileri tagStore'dan okunacak şekilde oluştur.
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10), // createLogotronicRequestFrame expects a number
  });

  // 3. TCP üzerinden gönder.
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    // tcpClient.send artık Buffer bekliyor
    tcpClientInstance.send(requestBuffer);
    logger.info(`jobList request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send jobList request.");
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for jobList service with response: ${xmlResponse}`
  );
  // Yanıtı işleme, PLC'ye MQTT mesajı gönderme vb.
}
