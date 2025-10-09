// src/service/assistantTaskQuery.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for assistantTaskQuery service"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for assistantTaskQuery service with response: ${xmlResponse}`
  );
}
