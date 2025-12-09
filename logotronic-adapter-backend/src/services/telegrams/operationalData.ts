// src/service/operationalData.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { config } from "../../config/config";
import { IPublishMessage } from "../../dataset/common";

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
      const currRealPower =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.operationalData.toServer.powerConsumption.powerCounter[${i}].currRealPower`
        ) || "0";
      const currReactivePower =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.operationalData.toServer.powerConsumption.powerCounter[${i}].currReactivePower`
        ) || "0";
      powerConsumptionXml += `<PowerCounter id="${id}" name="${name}" realPower="${realPower}" reactivePower="${reactivePower}" currRealPower="${currRealPower}" currReactivePower="${currReactivePower}"/>\n`;
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
  if (!responseBody || responseBody.length === 0) {
    logger.warn(
      "operationalData response handler received empty buffer; ignoring."
    );
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for operationalData service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error(
      "operationalData response handler could not parse XML; aborting."
    );
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "operationalData response handler could not extract domain/meta; aborting."
    );
    return;
  }

  if (domain.typeId !== parseInt(rapidaTypeIds.operationalData, 10)) {
    logger.error(
      `operationalData response typeId mismatch. Expected ${rapidaTypeIds.operationalData} but got ${domain.typeId}`
    );
    return;
  }

  // Cast to extended response type (contains productionOutput, energyLevel, energyMachine if present)
  const op = domain as any;

  // Tag definitions (need IDs) - use getTagDataByTagName not getValueByTagName
  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.operationalData.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.operationalData.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.operationalData.toMachine.errorReason"
  );
  const productionOutputTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.operationalData.toMachine.productionOutput"
  );
  const energyLevelTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.operationalData.toMachine.energyLevel"
  );
  const energyMachineTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.operationalData.toMachine.energyMachine"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "operationalData response handler missing required tag definitions (typeId or returnCode); aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if (domain.returnCode !== 1 && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: op.errorReason ?? "" });
  }

  if (productionOutputTag && op.productionOutput !== undefined) {
    vals.push({ id: productionOutputTag.id, val: op.productionOutput });
  }
  if (energyLevelTag && op.energyLevel !== undefined) {
    vals.push({ id: energyLevelTag.id, val: op.energyLevel });
  }
  if (energyMachineTag && op.energyMachine !== undefined) {
    vals.push({ id: energyMachineTag.id, val: op.energyMachine });
  }

  if (vals.length === 0) {
    logger.warn(
      "operationalData response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };

  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `operationalData response published to MQTT topic '${config.databus.topic.write}' with ${vals.length} values.`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.operationalData.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.operationalData.command.done' in tagStore. Cannot publish done message."
        );
        return;
      }

      const doneMqttMessage: IPublishMessage = {
        seq: 1,
        vals: [
          {
            id: doneTag.id,
            val: true,
          },
        ],
      };

      mqttClientInstance.publish(
        config.databus.topic.write,
        doneMqttMessage as any
      );
      logger.info(
        `Published 'operationalData' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish operationalData response to MQTT: ${
        (err as Error).message
      }`
    );
  }
}
