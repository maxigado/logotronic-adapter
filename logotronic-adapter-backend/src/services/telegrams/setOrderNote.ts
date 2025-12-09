// src/service/setOrderNote.ts
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
  logger.info("Logotronic Request Builder is called for setOrderNote service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.typeId"
    ) || rapidaTypeIds.setOrderNote;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.job.prodNo"
    ) || "";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.setOrderNote.toServer.job.jobNo"
    ) || "";

  // // Collect OrderNote from multiple tags
  // const orderNoteParts: string[] = [];
  // let i = 0;
  // while (true) {
  //   const part = tagStoreInstance.getValueByTagName(
  //     `LTA-Data.setOrderNote.toServer.orderNote`
  //   );
  //   // Stop if the tag doesn't exist or its value is null/undefined
  //   if (part === undefined || part === null) {
  //     break;
  //   }
  //   orderNoteParts.push(String(part));
  //   i++;
  // }
  // // Join the parts to form the complete OrderNote string
  // const orderNote = orderNoteParts.join("") || "";

  const orderNote = tagStoreInstance.getValueByTagName(
    `LTA-Data.setOrderNote.toServer.orderNote`
  );
  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
<OrderNote>${orderNote}</OrderNote>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`setOrderNote request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send setOrderNote request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  try {
    if (!responseBody || responseBody.length === 0) {
      logger.warn("setOrderNote response handler received empty buffer.");
      return;
    }
    const xmlResponse = responseBody.toString("utf8").trim();
    logger.info(`setOrderNote raw XML response: ${xmlResponse}`);

    const parsed = safeParseXml(xmlResponse);
    if (!parsed) {
      logger.error("setOrderNote response XML could not be parsed.");
      return;
    }

    const domain = parseDomainResponse(parsed);
    if (!domain || domain.typeId !== Number(rapidaTypeIds.setOrderNote)) {
      logger.error(
        `setOrderNote response domain parsing failed or typeId mismatch. Parsed typeId: ${domain?.typeId}`
      );
      return;
    }

    const { typeId, returnCode, errorReason } = domain as any; // meta-only

    const vals: { id: string; val: string | number | boolean }[] = [];

    const typeIdTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.setOrderNote.toMachine.typeId"
    );
    if (typeIdTag) {
      vals.push({ id: typeIdTag.id, val: typeId });
    } else {
      logger.warn("Tag not found: LTA-Data.setOrderNote.toMachine.typeId");
    }

    const returnCodeTag = tagStoreInstance.getTagDataByTagName(
      "LTA-Data.setOrderNote.toMachine.returnCode"
    );
    if (returnCodeTag) {
      vals.push({ id: returnCodeTag.id, val: returnCode });
    } else {
      logger.warn("Tag not found: LTA-Data.setOrderNote.toMachine.returnCode");
    }

    if (returnCode !== 1 && errorReason !== undefined) {
      const errorReasonTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.setOrderNote.toMachine.errorReason"
      );
      if (errorReasonTag) {
        vals.push({ id: errorReasonTag.id, val: errorReason });
      } else {
        logger.warn(
          "Tag not found: LTA-Data.setOrderNote.toMachine.errorReason"
        );
      }
    }

    if (vals.length === 0) {
      logger.warn(
        "setOrderNote response produced no tag values to publish (no matching tag IDs)."
      );
      return;
    }

    const mqttMessage: IPublishMessage = { seq: 1, vals };
    if (mqttClientInstance && mqttClientInstance.client.connected) {
      const topic = config.databus.topic.write;
      mqttClientInstance.publish(topic, mqttMessage as any);
      logger.info(
        `setOrderNote response published to MQTT topic '${topic}' with ${vals.length} values.`
      );

      // Publish done message after 1 second
      setTimeout(() => {
        const doneTag = tagStoreInstance.getTagDataByTagName(
          "LTA-Data.setOrderNote.command.done"
        );

        if (!doneTag) {
          logger.error(
            "Could not find the required tag 'LTA-Data.setOrderNote.command.done' in tagStore. Cannot publish done message."
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
          `Published 'setOrderNote' completed message to MQTT topic: ${topic}`
        );
      }, 1000);
    } else {
      logger.error(
        "MQTT client not connected. Cannot publish setOrderNote response."
      );
    }
  } catch (err) {
    logger.error(
      `Unhandled error in setOrderNote logotronicResponseHandler: ${err}`
    );
  }
}
