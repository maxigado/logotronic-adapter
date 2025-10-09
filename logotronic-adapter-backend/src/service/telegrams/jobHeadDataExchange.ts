// src/service/jobHeadDataExchange.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for jobHeadDataExchange service"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for jobHeadDataExchange service with response: ${xmlResponse}`
  );
}
