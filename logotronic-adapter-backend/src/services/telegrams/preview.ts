// src/service/preview.ts
import logger from "../../utility/logger";
import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";
import { safeParseXml } from "../../utility/xml";
import { parseDomainResponse } from "../../parsers/registry";
import { IPublishMessage } from "../../dataset/common";
import { config } from "../../config/config";
import WebSocketManager from "../../utility/websocket";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for preview service");

  const typeId =
    tagStoreInstance.getValueByTagName("LTA-Data.preview.toServer.typeId") ||
    rapidaTypeIds.preview;

  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.preview.toServer.job.orderNo"
    ) || "";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.preview.toServer.job.prodNo"
    ) || "";
  const side =
    tagStoreInstance.getValueByTagName("LTA-Data.preview.toServer.job.side") ||
    "0";
  const inkCode =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.preview.toServer.job.inkCode"
    ) || "1";

  const serviceXml = `
<Request typeId="${typeId}">
<Job orderNo="${orderNo}" prodNo="${prodNo}" side="${side}" inkCode="${inkCode}"/>
</Request>
`;

  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`preview request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error("TCP Client is not connected. Cannot send preview request.");
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  if (!responseBody || responseBody.length === 0) {
    logger.warn("preview response handler received empty buffer; ignoring.");
    return;
  }

  const xmlResponse = responseBody.toString("utf8").trim();
  logger.debug(
    `Logotronic Response Handler is called for preview service with response: ${xmlResponse}`
  );

  const root = safeParseXml(xmlResponse);
  if (!root) {
    logger.error("preview response handler could not parse XML; aborting.");
    return;
  }

  const domain = parseDomainResponse(root);
  if (!domain) {
    logger.error(
      "preview response handler could not extract meta/domain; aborting."
    );
    return;
  }

  const expectedTypeId = parseInt(rapidaTypeIds.preview, 10);
  if (domain.typeId !== expectedTypeId) {
    logger.error(
      `preview response typeId mismatch. Expected ${expectedTypeId} but got ${domain.typeId}`
    );
    return;
  }

  const previewDomain = domain as any; // has jpegData[] from parser

  const typeIdTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.preview.toMachine.typeId"
  );
  const returnCodeTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.preview.toMachine.returnCode"
  );
  const errorReasonTag = tagStoreInstance.getTagDataByTagName(
    "LTA-Data.preview.toMachine.errorReason"
  );

  if (!typeIdTag || !returnCodeTag) {
    logger.error(
      "preview response missing required meta tag IDs; aborting publish."
    );
    return;
  }

  const vals: { id: string; val: string | number | boolean }[] = [
    { id: typeIdTag.id, val: domain.typeId },
    { id: returnCodeTag.id, val: domain.returnCode },
  ];

  // Include errorReason only when returnCode is 0 or -1
  if (
    (domain.returnCode === 0 || domain.returnCode === -1) &&
    errorReasonTag &&
    previewDomain.errorReason !== undefined
  ) {
    vals.push({ id: errorReasonTag.id, val: previewDomain.errorReason });
  }

  // Publish all JPEGData entries (no artificial cap)
  const entries = previewDomain.jpegData || [];
  if (!entries.length) {
    logger.warn(
      "preview response contains no JPEGData elements after parsing; publishing only meta. Raw XML might have unexpected structure."
    );
  }
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // Attempt indexed tag names first, then fall back to base names (as per user instruction)
    const sideTag =
      tagStoreInstance.getTagDataByTagName(
        `LTA-Data.preview.toMachine.JPEGData[${i}].side`
      ) ||
      tagStoreInstance.getTagDataByTagName(
        "LTA-Data.preview.toMachine.JPEGData.side"
      );
    const cdataTag =
      tagStoreInstance.getTagDataByTagName(
        `LTA-Data.preview.toMachine.JPEGData[${i}].cdata`
      ) ||
      tagStoreInstance.getTagDataByTagName(
        "LTA-Data.preview.toMachine.JPEGData.cdata"
      );
    if (sideTag && entry.side !== undefined)
      vals.push({ id: sideTag.id, val: entry.side });
    if (cdataTag && entry.dataBase64 !== undefined)
      vals.push({ id: cdataTag.id, val: entry.dataBase64 });
  }

  if (vals.length === 0) {
    logger.warn(
      "preview response produced no tag values to publish (no matching tag IDs)."
    );
    return;
  }

  const mqttMessage: IPublishMessage = { seq: 1, vals };
  try {
    mqttClientInstance.publish(config.databus.topic.write, mqttMessage as any);
    logger.info(
      `preview response published with ${vals.length} values (including ${
        previewDomain.jpegData?.length || 0
      } JPEGData entries).`
    );

    // Publish done message after 1 second
    setTimeout(() => {
      const doneTag = tagStoreInstance.getTagDataByTagName(
        "LTA-Data.preview.command.done"
      );

      if (!doneTag) {
        logger.error(
          "Could not find the required tag 'LTA-Data.preview.command.done' in tagStore. Cannot publish done message."
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
        `Published 'preview' completed message to MQTT topic: ${config.databus.topic.write}`
      );
    }, 1000);
    // Broadcast preview images (up to two) over WebSocket to frontend
    if (entries.length) {
      try {
        const ws = WebSocketManager.getInstance();
        const payload = {
          timestamp: new Date().toISOString(),
          images: entries.slice(0, 2).map((e: any) => ({
            side: e.side,
            // Provide ready-to-use data URL for <img src>
            dataUrl: `data:image/jpeg;base64,${e.dataBase64}`,
          })),
        };
        ws.broadcast("previewImages", payload);
        logger.info(
          `Broadcasted ${payload.images.length} preview image(s) over WebSocket.`
        );
      } catch (wsErr) {
        logger.error(
          `Failed to broadcast preview images: ${(wsErr as Error).message}`
        );
      }
    }
  } catch (err) {
    logger.error(
      `Failed to publish preview response: ${(err as Error).message}`
    );
  }
}
