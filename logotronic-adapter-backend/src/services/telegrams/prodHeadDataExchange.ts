// src/service/prodHeadDataExchange.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";

/**
 * Logotronic Request Builder for prodHeadDataExchange service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for prodHeadDataExchange service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.typeId"
    ) || rapidaTypeIds.prodHeadDataExchange;

  // Job attributes
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.orderNo"
    ) || "";
  const partOrderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.partOrderNo"
    ) || "";
  const partOrderName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.partOrderName"
    ) || "";
  const printStandardFront =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.printStandardFront"
    ) || "";
  const printStandardBack =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.job.printStandardBack"
    ) || "";

  // Delivery attributes
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.delivery.amount"
    ) || "0";
  const date =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.delivery.date"
    ) || Date.now().toString();

  // Paper attributes
  const paperNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.paper.paperNo"
    ) || "";
  const printWidth =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.paper.printWidth"
    ) || "0";
  const printHeight =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.prodHeadDataExchange.toServer.paper.printHeight"
    ) || "0";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" partOrderNo="${partOrderNo}" partOrderName="${partOrderName}" printStandardFront="${printStandardFront}" printStandardBack="${printStandardBack}"/>
  <Delivery amount="${amount}" date="${date}" />
  <Paper paperNo="${paperNo}" printWidth="${printWidth}" printHeight="${printHeight}"/>
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
      `prodHeadDataExchange request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send prodHeadDataExchange request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn(
        "prodHeadDataExchange response handler received empty buffer."
      );
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`prodHeadDataExchange raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("prodHeadDataExchange response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    const expectedTypeId = Number(rapidaTypeIds.prodHeadDataExchange);
    if (!domain || domain.typeId !== expectedTypeId) {
      logger.error(
        `prodHeadDataExchange response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}, expected: ${expectedTypeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.prodHeadDataExchange.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.prodHeadDataExchange.toMachine.typeId"
      );
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.prodHeadDataExchange.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.prodHeadDataExchange.toMachine.returnCode"
      );
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.prodHeadDataExchange.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.prodHeadDataExchange.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "prodHeadDataExchange response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `prodHeadDataExchange response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.prodHeadDataExchange.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.prodHeadDataExchange.command.done' in tagStore. Cannot publish done message."
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
          `Published 'prodHeadDataExchange' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish prodHeadDataExchange response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in prodHeadDataExchange logotronicResponseHandler: ${err}`
    );
  }
}
