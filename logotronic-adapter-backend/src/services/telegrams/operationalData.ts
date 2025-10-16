// src/service/operationalData.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for operationalData service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for operationalData service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.typeId"
    ) || rapidaTypeIds.operationalData;

  // Job Details
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.job.orderNo"
    ) || "x";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.job.prodNo"
    ) || "y";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.job.jobNo"
    ) || "z";

  // OpData Details
  const timeStamp =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.opData.timeStamp"
    ) || Date.now().toString();
  const speed =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.opData.speed"
    ) || "0";
  const comment =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.opData.comment"
    ) || "";

  // Counter Details
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.counter.amount"
    ) || "0";
  const totalAmount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.counter.totalAmount"
    ) || "0";
  const totalCounter =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.counter.totalCounter"
    ) || "0";
  const totalCounterGross =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.counter.totalCounterGross"
    ) || "0";
  const opHours =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.counter.opHours"
    ) || "0";

  // Activity Details
  const activityNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.activity.no"
    ) || "";
  const activityValue =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.activity.value"
    ) || "";
  const activityUnit =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.activity.unit"
    ) || "";

  // Machine State
  const machineState =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.machine.state"
    ) || "0";
  const jobState =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.machine.jobState"
    ) || "0";
  const timeState =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.operationalData.toServer.machine.timeState"
    ) || "0";

  // Power Consumption - dynamically generate PowerCounter elements
  let powerConsumptionXml = "";
  for (let i = 0; i < 4; i++) {
    const id = tagStoreInstance.getValueByTagName(
      `LTA-Data.operationalData.toServer.powerConsumption.powerCounter[${i}].id`
    );
    // Only add the counter if its ID exists in the tag store
    if (id) {
      const name =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.operationalData.toServer.powerConsumption.powerCounter[${i}].name`
        ) || "";
      const realPower =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.operationalData.toServer.powerConsumption.powerCounter[${i}].realPower`
        ) || "0";
      const reactivePower =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.operationalData.toServer.powerConsumption.powerCounter[${i}].reactivePower`
        ) || "0";
      powerConsumptionXml += `<PowerCounter id="${id}" name="${name}" realPower="${realPower}" reactivePower="${reactivePower}"/>\n`;
    }
  }

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
  <OpData timeStamp="${timeStamp}" speed="${speed}" comment="${comment}">
    <Counter amount="${amount}" totalAmount="${totalAmount}" totalCounter="${totalCounter}" opHours="${opHours}" totalCounterGross="${totalCounterGross}"/>
    <Activity no="${activityNo}" value="${activityValue}" units="${activityUnit}"/>
    <Machine state="${machineState}" jobState="${jobState}" timeState="${timeState}"/>
    <PowerConsumption>
      ${powerConsumptionXml.trim()}
    </PowerConsumption>
  </OpData>
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
      `operationalData request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send operationalData request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for operationalData service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
