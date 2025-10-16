// src/service/machinePlanList.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for machinePlanList service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.machinePlanList.toServer.typeId"
    ) || rapidaTypeIds.machinePlanList;

  const jobLines: string[] = [];
  for (let i = 0; i < 10; i++) {
    const orderNo = tagStoreInstance.getValueByTagName(
      `LTA-Data.machinePlanList.toServer.job[${i}].orderNo`
    );

    // Only add a job if the order number exists and is not an empty string
    if (orderNo) {
      const prodNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machinePlanList.toServer.job[${i}].prodNo`
        ) || "";
      const jobNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.machinePlanList.toServer.job[${i}].jobNo`
        ) || "";

      jobLines.push(
        `<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}" />`
      );
    }
  }

  if (jobLines.length === 0) {
    logger.warn(
      "No jobs found in tagStore to build machinePlanList request. Aborting."
    );
    return;
  }

  const serviceXml = `
<Request typeId="${typeId}">
${jobLines.join("\n")}
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(
      `machinePlanList request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send machinePlanList request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for machinePlanList service with response: ${xmlResponse}`
  );
}
