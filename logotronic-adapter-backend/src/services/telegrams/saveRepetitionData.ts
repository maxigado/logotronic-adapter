// src/service/saveRepetitionData.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Logotronic Request Builder is called for saveRepetitionData service"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for saveRepetitionData service with response: ${xmlResponse}`
  );
}
