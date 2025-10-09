// src/service/operationalData.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for operationalData service"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for operationalData service with response: ${xmlResponse}`
  );
}
