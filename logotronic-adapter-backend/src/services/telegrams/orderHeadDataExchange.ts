// src/service/orderHeadDataExchange.ts
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
 * Logotronic Request Builder for orderHeadDataExchange service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for orderHeadDataExchange service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.typeId"
    ) || rapidaTypeIds.orderHeadDataExchange;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.job.orderNo"
    ) || "";
  const orderName =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.job.orderName"
    ) || "";
  const amount =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.delivery.amount"
    ) || "0";
  const date =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.delivery.date"
    ) || Date.now().toString();
  const customerNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.orderHeadDataExchange.toServer.customer.customerNo"
    ) || "";

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" orderName="${orderName}"/>
  <Delivery amount="${amount}" date="${date}" />
  <Customer customerNo="${customerNo}" />
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
      `orderHeadDataExchange request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send orderHeadDataExchange request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn(
        "orderHeadDataExchange response handler received empty buffer."
      );
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`orderHeadDataExchange raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("orderHeadDataExchange response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    const expectedTypeId = Number(rapidaTypeIds.orderHeadDataExchange);
    if (!domain || domain.typeId !== expectedTypeId) {
      logger.error(
        `orderHeadDataExchange response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}, expected: ${expectedTypeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.orderHeadDataExchange.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.orderHeadDataExchange.toMachine.typeId"
      );
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.orderHeadDataExchange.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn(
        "Tag not found: LTA-Data.orderHeadDataExchange.toMachine.returnCode"
      );
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.orderHeadDataExchange.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.orderHeadDataExchange.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "orderHeadDataExchange response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `orderHeadDataExchange response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.orderHeadDataExchange.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.orderHeadDataExchange.command.done' in tagStore. Cannot publish done message."
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
          `Published 'orderHeadDataExchange' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish orderHeadDataExchange response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in orderHeadDataExchange logotronicResponseHandler: ${err}`
    );
  }
}
