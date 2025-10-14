// src/service/error.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Error service has no Logotronic Request. Error Response will be received when Logotronic returns error"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for error service with response: ${xmlResponse}`
  );
}
