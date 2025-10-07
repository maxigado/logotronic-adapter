import express, { Request, Response } from "express";
import { getMachineStatus } from "./get"; // Import the read function

const router = express.Router();

router.get("/", (req: Request, res: Response) => {
  res.render("index", {
    title: "EJS + TypeScript",
    message: "TypeScript ile EJS render 🎯",
  });
});

router.get("/status", getMachineStatus);
router.use((req, res) => {
  res.status(404).json({ message: "End point is not found" });
});

export default router;
