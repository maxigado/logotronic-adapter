// src/service/jobList.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
// tagStoreInstance artık burada değil, sadece framebuilder'da kullanılıyor
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";
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

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn("jobList response handler received empty buffer; ignoring.");
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();

  // Validate XML - check for multiple XML declarations (indicates corrupted/concatenated data)
  const xmlDeclCount = (xmlResponse.match(/<\?xml\s+version=/g) || []).length;
  if (xmlDeclCount > 1) {
    logger.error(
      `jobList response contains ${xmlDeclCount} XML declarations. Response may be corrupted or concatenated. First 500 chars: ${xmlResponse.substring(
        0,
        500
      )}`
    );
    return;
  }

  // Check for basic XML structure validity
  if (!xmlResponse.includes("<?xml") && !xmlResponse.startsWith("<Response")) {
    logger.error(
      `jobList response does not appear to be valid XML. First 200 chars: ${xmlResponse.substring(
        0,
        200
      )}`
    );
    return;
  }

  logger.info(
    `Logotronic Response Handler is called for jobList service with response length: ${xmlResponse.length} bytes`
  );
  logger.debug(`XML Response preview: ${xmlResponse.substring(0, 500)}...`);

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error("jobList response handler could not parse XML; aborting.");
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "jobList response handler could not extract meta/domain; aborting."
    );
    return;
  }
  // JobList Response typeID comes empty. Validation is skipped.
  // const expectedTypeId = parseInt(rapidaTypeIds.jobList, 10);
  // if (domain.typeId !== expectedTypeId) {
  //   logger.error(
  //     `jobList response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
  //   );
  //   return;
  // }

  const jl = domain as any; // has jobs[]

  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobList.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobList.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.jobList.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "jobList response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  if ((domain.returnCode === 0 || domain.returnCode === -1) && errorReasonTag) {
    vals.push({ id: errorReasonTag.id, val: jl.errorReason ?? "" });
  }

  // Get max number of jobs from TagStore settings
  const maxNumberOfJobs =
    (tagStoreInstance.getValueByTagName(
      "LTA-Settings.application.limitations.maxNumberOfJob"
    ) as number) || 100;

  // Publish up to maxNumberOfJobs jobs
  for (let jIdx = 0; jIdx < maxNumberOfJobs; jIdx++) {
    const job = jl.jobs?.[jIdx];
    if (!job) break;
    // Order fields
    const orderNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].order.no`
    );
    const orderNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].order.name`
    );
    const customerNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].order.customerNo`
    );
    const customerNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].order.customerName`
    );
    const deliveryDateTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].order.deliveryDate`
    );
    // Prod fields
    const prodNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].prod.no`
    );
    const prodNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].prod.name`
    );
    const prodPaperNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].prod.paperNo`
    );
    const prodPaperNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].prod.paperName`
    );
    const prodPaperThicknessTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].prod.paperTickness`
    ); // tag naming uses paperTickness
    const prodAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].prod.amount`
    );
    // Job fields
    const jobNoTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.no`
    );
    const jobNameTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.name`
    );
    const jobAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.amount`
    );
    const jobMinAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.minAmount`
    );
    const jobMaxAmountTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.maxAmount`
    );
    const subsidyTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.subsidy`
    );
    const subsidy2Tag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.subsidy2`
    );
    const copyTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.copy`
    );
    const statusTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.status`
    );
    const setupTimeTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.setupTime`
    );
    const printTimeTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.printTime`
    );
    const planStartTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.planStart`
    );
    const workplaceIdTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.workplaceId`
    );
    const reproTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.rePro`
    );
    const planningStateTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.planningState`
    );
    const priorityTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.priority`
    );
    const startupWasteTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.startupWaste`
    );
    const grossCopiesTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.grossCopies`
    );
    const netCopiesTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.netCopies`
    );
    const markOrDetectTag = tagStoreInstance.getTagDataByTagName(
      `LTA-Data.jobList.toMachine.jobData[${jIdx}].job.markOrDetect`
    );

    // Push values if tags exist
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
      "jobList response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `jobList response published with ${vals.length} values (including ${
        jl.jobs?.length || 0
      } jobs).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.jobList.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.jobList.command.done' in tagStore. Cannot publish done message."
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
        `Published 'jobList' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
  } catch (err) {
    logger.error(
      `Failed to publish jobList response: ${(err as Error).message}`
    );
  }
}
