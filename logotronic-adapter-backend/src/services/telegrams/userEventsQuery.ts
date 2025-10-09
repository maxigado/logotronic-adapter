// src/service/userEventsQuery.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for userEventsQuery service"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for userEventsQuery service with response: ${xmlResponse}`
  );
}
