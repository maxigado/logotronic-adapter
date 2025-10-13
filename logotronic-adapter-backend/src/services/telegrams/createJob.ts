// src/service/createJob.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for createJob service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.createJob.toServer.typeId") ||
    rapidaTypeIds.createJob;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.prodNo"
    ) || "";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.jobNo"
    ) || "";
  const name =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.name"
    ) || "";
  const setupTime =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.setupTime"
    ) || "0:00";
  const printTime =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.printTime"
    ) || "0:00";
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.amount"
    ) || "0";
  const add =
    tagStoreInstance.getValueByTagName("LTA-Data.createJob.toServer.job.add") ||
    "0";
  const add2 =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.add2"
    ) || "0";
  const copy =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.copy"
    ) || "0";
  const comment =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.createJob.toServer.job.comment"
    ) || "";

  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}" name="${name}" setupTime="${setupTime}" printTime="${printTime}" amount="${amount}" add="${add}" add2="${add2}" copy="${copy}" comment="${comment}"/>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`createJob request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send createJob request.");
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for createJob service with response: ${xmlResponse}`
  );
}
