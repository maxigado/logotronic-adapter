// src/service/jobPlan.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

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

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn("jobPlan response handler received empty buffer; ignoring.");
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.info(
    `Logotronic Response Handler is called for jobPlan service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error("jobPlan response handler could not parse XML; aborting.");
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "jobPlan response handler could not extract meta/domain; aborting."
    );
    return;
  }

  const expectedTypeId = parseInt(rapidaTypeIds.jobPlan, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `jobPlan response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const jp = domain as any; // has jobs[]

  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobPlan.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobPlan.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobPlan.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "jobPlan response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if ((domain.returnCode === 0 || domain.returnCode === -1) && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: jp.errorReason ?? "" });
  }

  // Publish up to 51 jobs
  for (let jIdx = 0; jIdx < 51; jIdx++) {
    const job = jp.jobs?.[jIdx];
    if (!job) break;
    const orderNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].order.no`
    );
    const orderNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].order.name`
    );
    const customerNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].order.customerNo`
    );
    const customerNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].order.customerName`
    );
    const deliveryDateTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].order.deliveryDate`
    );
    const prodNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].prod.no`
    );
    const prodNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].prod.name`
    );
    const prodPaperNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].prod.paperNo`
    );
    const prodPaperNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].prod.paperName`
    );
    const prodPaperThicknessTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].prod.paperTickness`
    );
    const prodAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].prod.amount`
    );
    const jobNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.no`
    );
    const jobNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.name`
    );
    const jobAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.amount`
    );
    const jobMinAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.minAmount`
    );
    const jobMaxAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.maxAmount`
    );
    const subsidyTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.subsidy`
    );
    const subsidy2Tag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.subsidy2`
    );
    const copyTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.copy`
    );
    const statusTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.status`
    );
    const setupTimeTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.setupTime`
    );
    const printTimeTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.printTime`
    );
    const planStartTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.planStart`
    );
    const workplaceIdTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.workplaceId`
    );
    const reproTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.rePro`
    );
    const planningStateTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.planningState`
    );
    const priorityTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.priority`
    );
    const startupWasteTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.startupWaste`
    );
    const grossCopiesTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.grossCopies`
    );
    const netCopiesTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.netCopies`
    );
    const markOrDetectTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobPlan.toMachine.jobData[${jIdx}].job.markOrDetect`
    );

    if (orderNoTag && job.orderNo !== undefined)
      vals.push({ id: orderNoTag.id, val: job.orderNo });
    if (orderNameTag && job.orderName !== undefined)
      vals.push({ id: orderNameTag.id, val: job.orderName });
    if (customerNoTag && job.customerNo !== undefined)
      vals.push({ id: customerNoTag.id, val: job.customerNo });
    if (customerNameTag && job.customerName !== undefined)
      vals.push({ id: customerNameTag.id, val: job.customerName });
    if (deliveryDateTag && job.deliveryDate !== undefined)
      vals.push({ id: deliveryDateTag.id, val: job.deliveryDate });
    if (prodNoTag && job.prodNo !== undefined)
      vals.push({ id: prodNoTag.id, val: job.prodNo });
    if (prodNameTag && job.prodName !== undefined)
      vals.push({ id: prodNameTag.id, val: job.prodName });
    if (prodPaperNoTag && job.prodPaperNo !== undefined)
      vals.push({ id: prodPaperNoTag.id, val: job.prodPaperNo });
    if (prodPaperNameTag && job.prodPaperName !== undefined)
      vals.push({ id: prodPaperNameTag.id, val: job.prodPaperName });
    if (prodPaperThicknessTag && job.prodPaperThickness !== undefined)
      vals.push({ id: prodPaperThicknessTag.id, val: job.prodPaperThickness });
    if (prodAmountTag && job.prodAmount !== undefined)
      vals.push({ id: prodAmountTag.id, val: job.prodAmount });
    if (jobNoTag && job.jobNo !== undefined)
      vals.push({ id: jobNoTag.id, val: job.jobNo });
    if (jobNameTag && job.jobName !== undefined)
      vals.push({ id: jobNameTag.id, val: job.jobName });
    if (jobAmountTag && job.jobAmount !== undefined)
      vals.push({ id: jobAmountTag.id, val: job.jobAmount });
    if (jobMinAmountTag && job.jobMinAmount !== undefined)
      vals.push({ id: jobMinAmountTag.id, val: job.jobMinAmount });
    if (jobMaxAmountTag && job.jobMaxAmount !== undefined)
      vals.push({ id: jobMaxAmountTag.id, val: job.jobMaxAmount });
    if (subsidyTag && job.subsidy !== undefined)
      vals.push({ id: subsidyTag.id, val: job.subsidy });
    if (subsidy2Tag && job.subsidy2 !== undefined)
      vals.push({ id: subsidy2Tag.id, val: job.subsidy2 });
    if (copyTag && job.copy !== undefined)
      vals.push({ id: copyTag.id, val: job.copy });
    if (statusTag && job.status !== undefined)
      vals.push({ id: statusTag.id, val: job.status });
    if (setupTimeTag && job.setupTime !== undefined)
      vals.push({ id: setupTimeTag.id, val: job.setupTime });
    if (printTimeTag && job.printTime !== undefined)
      vals.push({ id: printTimeTag.id, val: job.printTime });
    if (planStartTag && job.planStart !== undefined)
      vals.push({ id: planStartTag.id, val: job.planStart });
    if (workplaceIdTag && job.workplaceId !== undefined)
      vals.push({ id: workplaceIdTag.id, val: job.workplaceId });
    if (reproTag && job.repro !== undefined)
      vals.push({ id: reproTag.id, val: job.repro });
    if (planningStateTag && job.planningState !== undefined)
      vals.push({ id: planningStateTag.id, val: job.planningState });
    if (priorityTag && job.priority !== undefined)
      vals.push({ id: priorityTag.id, val: job.priority });
    if (startupWasteTag && job.startupWaste !== undefined)
      vals.push({ id: startupWasteTag.id, val: job.startupWaste });
    if (grossCopiesTag && job.grossCopies !== undefined)
      vals.push({ id: grossCopiesTag.id, val: job.grossCopies });
    if (netCopiesTag && job.netCopies !== undefined)
      vals.push({ id: netCopiesTag.id, val: job.netCopies });
    if (markOrDetectTag && job.markOrDetect !== undefined)
      vals.push({ id: markOrDetectTag.id, val: job.markOrDetect });
  }

  if (vals.length === 0) {
    logger.warn(
      "jobPlan response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `jobPlan response published with ${vals.length} values (including ${
        jp.jobs?.length || 0
      } jobs).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.jobPlan.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.jobPlan.command.done' in tagStore. Cannot publish done message."
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
        `Published 'jobPlan' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish jobPlan response: ${(err as Error).message}`
    );
  }
}
