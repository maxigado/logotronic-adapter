import express, { Request, Response } from "express";
import { getMachineStatus, getTagStoreByID, getTagDataById } from "./get"; // Import the read function
import { getVersion } from "./version"; // Import version endpoint

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.render("index", {
    title: "EJS + TypeScript",
    message: "TypeScript ile EJS render 🎯",
  });
});

router.get("/preview", (req: Request, res: Response) => {
  res.render("preview", {
    title: "Preview - Logotronic Adapter",
  });
});

router.get("/status", getMachineStatus);
router.get("/tagstore", getTagStoreByID);
router.get("/tagstore/:id", getTagDataById);
router.get("/version", getVersion);

router.use((req, res) => {
  res.status(404).json({ message: "End point is not found" });
});

export default router;
