// src/service/bdePersonnel.ts
import logger from "../../utility/logger";
import { tcpClientInstance } from "../dataprocessing";
import { rapidaTypeIds } from "../../dataset/typeid";
import { tagStoreInstance } from "../../store/tagstore";
import { createLogotronicRequestFrame } from "../../utility/framebuilder";

/**
 * Logotronic Request Builder for bdePersonnel service.
 * This function can send multiple "Personal" records in one request.
 */
export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for bdePersonnel service");

  const typeId =
    tagStoreInstance.getValueByTagName(
      "LTA-Data.bdePersonnel.toServer.typeId"
    ) || rapidaTypeIds.bdePersonnel;

  let personalXmlElements = "";
  // Loop to check for multiple personnel entries, assuming a max of 10.
  for (let i = 0; i < 10; i++) {
    const id = tagStoreInstance.getValueByTagName(
      `LTA-Data.bdePersonnel.toServer.personal[${i}].id`
    );

    // If an ID exists for this index, create a <Personal> element.
    if (id) {
      const activityNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal[${i}].activityNo`
        ) || "";
      const timestamp =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal[${i}].timeStamp`
        ) || Date.now().toString();
      const comment =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal[${i}].comment`
        ) || "";

      personalXmlElements += `<Personal activityNo="${activityNo}" id="${id}" timestamp="${timestamp}" comment="${comment}"/>\n`;
    }
  }

  // If no personnel elements were found, we can either send an empty request or log an error.
  // For now, we'll proceed, which might send a request with an empty body if no tags are set.
  if (!personalXmlElements) {
    logger.warn(
      "No personnel data found in tagStore for bdePersonnel request."
    );
    // Fallback to single-entry tags if multi-entry fails
    const id = tagStoreInstance.getValueByTagName(
      `LTA-Data.bdePersonnel.toServer.personal.id`
    );
    if (id) {
      const activityNo =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal.activityNo`
        ) || "";
      const timestamp =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal.timeStamp`
        ) || Date.now().toString();
      const comment =
        tagStoreInstance.getValueByTagName(
          `LTA-Data.bdePersonnel.toServer.personal.comment`
        ) || "";
      personalXmlElements = `<Personal activityNo="${activityNo}" id="${id}" timestamp="${timestamp}" comment="${comment}"/>`;
    }
  }

  // 1. Telegram's XML body
  const serviceXml = `
<Request typeId="${typeId}">
  ${personalXmlElements.trim()}
</Request>
`;

  // 2. Create the binary request frame
  const requestBuffer = createLogotronicRequestFrame(serviceXml, {
    requestType: parseInt(typeId.toString(), 10),
  });

  // 3. Send over TCP
  if (tcpClientInstance && tcpClientInstance.isConnected) {
    tcpClientInstance.send(requestBuffer);
    logger.info(`bdePersonnel request (TypeID: ${typeId}) sent successfully.`);
  } else {
    logger.error(
      "TCP Client is not connected. Cannot send bdePersonnel request."
    );
  }
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for bdePersonnel service with response: ${xmlResponse}`
  );
  // Further processing of the response
}
