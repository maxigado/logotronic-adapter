// src/service/createJob.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { mqttClientInstance } from "../dataprocessing";
import { config } from "../../config/config";
import { IPublishMessage } from "../../dataset/common";

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

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("createJob response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`createJob raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("createJob response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== 10063) {
      logger.error(
        `createJob response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.createJob.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.createJob.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.createJob.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.createJob.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.createJob.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn("Tag not found: LTA-Data.createJob.toMachine.errorReason");
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "createJob response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `createJob response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.createJob.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.createJob.command.done' in tagStore. Cannot publish done message."
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

        mqttClientInstance.publish(topic, doneMqttMessage as any);
        logger.info(
          `Published 'createJob' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish createJob response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in createJob logotronicResponseHandler: ${err}`
    );
  }
}
