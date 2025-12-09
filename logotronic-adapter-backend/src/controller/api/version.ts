import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Get current git version information
export const getVersion = (req: Request, res: Response): void => {
  try {
    const versionInfo: any = {
      application: "logotronic-adapter-backend",
      version: "1.0.0", // From package.json
    };

    // Try to get current git commit hash
    try {
      const commitHash = execSync("git rev-parse HEAD", {
        cwd: path.join(__dirname, "../.."),
        encoding: "utf-8",
      }).trim();
      versionInfo.commit = commitHash;
    } catch (error) {
      versionInfo.commit = "unknown";
    }

    // Try to get current git branch
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: path.join(__dirname, "../.."),
        encoding: "utf-8",
      }).trim();
      versionInfo.branch = branch;
    } catch (error) {
      versionInfo.branch = "unknown";
    }

    // Read last update information if available
    const updateInfoPath = path.join(__dirname, "../../last-update.json");
    if (fs.existsSync(updateInfoPath)) {
      try {
        const updateInfo = JSON.parse(fs.readFileSync(updateInfoPath, "utf-8"));
        versionInfo.lastUpdate = updateInfo;
      } catch (error) {
        versionInfo.lastUpdate = null;
      }
    } else {
      versionInfo.lastUpdate = null;
    }

    res.status(200).json(versionInfo);
  } catch (error: any) {
    res.status(500).json({
      error: "Failed to retrieve version information",
      message: error.message,
    });
  }
};
