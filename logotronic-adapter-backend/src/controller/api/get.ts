import logger from "../../utility/logger";
import { Request, Response } from "express";
import { tagStoreInstance } from "../../store/tagstore";

export async function getMachineStatus(req: Request, res: Response) {
  try {
    res.json({ status: "OK" });
  } catch (error) {
    logger.error(`Failure on getMachineStatus Request: ${error}`);
    res.status(500).send("Internal Server Error");
  }
}

export async function getTagStoreByID(req: Request, res: Response) {
  try {
    const allTags = tagStoreInstance.getAllTagData();
    res.json(allTags);
  } catch (error) {
    logger.error(`Failure on getTagStoreByID Request: ${error}`);
    res.status(500).send("Internal Server Error");
  }
}

export async function getTagDataById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const tagData = tagStoreInstance.getTagDataById(id);

    if (tagData) {
      res.json(tagData);
    } else {
      res.status(404).json({ message: `Tag with ID '${id}' not found.` });
    }
  } catch (error) {
    logger.error(`Failure on getTagDataById Request: ${error}`);
    res.status(500).send("Internal Server Error");
  }
}
