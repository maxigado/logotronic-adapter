import logger from "../../utility/logger";
import { Request, Response } from "express";

export async function getMachineStatus(req: Request, res: Response) {
  try {
    res.json({ status: "OK" });
  } catch (error) {
    logger.error(`Failure on getMachineStatus Request: ${error}`);
    res.status(500).send("Internal Server Error");
  }
}
