// src/service/machineShifts.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for machineShifts service");
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for machineShifts service with response: ${xmlResponse}`
  );
}
