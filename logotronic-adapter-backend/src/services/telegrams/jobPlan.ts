// src/service/jobPlan.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for jobPlan service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.jobPlan.toServer.typeId") ||
    rapidaTypeIds.jobPlan;

  const planningStatus =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobPlan.toServer.params.planningStatus"
    ) || "101";
  const fromDate =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobPlan.toServer.params.fromDate"
    ) || "03.03.2007 12:03";
  const toDate =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.jobPlan.toServer.params.toDate"
    ) || "04.03.2007 17:00";

  const serviceXml = `
<Request typeId="${typeId}">
<Params planningStatus="${planningStatus}" fromDate="${fromDate}" toDate="${toDate}" />
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`jobPlan request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send jobPlan request.");
  }
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for jobPlan service with response: ${xmlResponse}`
  );
}
