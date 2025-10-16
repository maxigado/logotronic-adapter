// src/service/saveRepetitionData.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for saveRepetitionData service.
 */
export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for saveRepetitionData service"
  );

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.typeId"
    ) || rapidaTypeIds.saveRepetitionData;

  // Job attributes (Note: not in the example XML, but included based on inputs)
  const orderNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.job.orderNo"
    ) || "x";
  const prodNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.job.prodNo"
    ) || "y";
  const jobNo =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.job.jobNo"
    ) || "z";

  // SaveRepetitionData attributes
  const identifier =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.saveRepetitionData.toServer.saveRepetitionData.identifier"
    ) || "";

  // Collect raw data from the buffer tags
  const rawDataBytes: number[] = [];
  let i = 0;
  while (true) {
    const byteValue = tagStoreInstance.getValueByTagName(
      `LTA-Data.saveRepetitionData.toServer.saveRepetitionData.rawData.buffer[${i}]`
    );
    if (byteValue === undefined || byteValue === null) {
      break; // Stop when no more buffer tags are found
    }
    rawDataBytes.push(Number(byteValue));
    i++;
  }

  // Convert the byte array to a Buffer and then to a Base64 string
  const rawDataBuffer = Buffer.from(rawDataBytes);
  const base64Data = rawDataBuffer.toString("base64");

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  <Job orderNo="${orderNo}" prodNo="${prodNo}" jobNo="${jobNo}"/>
  <SaveRepetitionData identifier="${identifier}">
    ${base64Data}
  </SaveRepetitionData>
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
      `saveRepetitionData request (TypeID: ${typeId}) sent successfully.`
    );
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send saveRepetitionData request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for saveRepetitionData service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
