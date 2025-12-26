import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import logger from "../utility/logger";
import { tagStoreInstance } from "../store/tagstore";
import { IPublishMessage } from "../dataset/common";

// Language mapping to determine which files to download
const languageMapping: { [key: string]: number } = {
  German: 0,
  "English (GB)": 1,
  "English (US)": 8,
  French: 2,
  Italian: 3,
  Hungary: 4,
  Spain: 5,
  Swedish: 6,
  Danish: 7,
  Dutch: 9,
  Portuguese: 10,
  Polish: 11,
  Russian: 12,
  Greek: 13,
  Chinese: 14,
  Czech: 15,
  Korean: 16,
  Turkish: 17,
  Croatian: 18,
  Finnish: 19,
  Unknown: 20,
  Japanese: 21,
  Sloveccia: 22,
  Romanian: 23,
  Vietnamese: 24,
  Arabic: 25,
  Thai: 26,
  Slovenian: 27,
  "Chinese (Traditional)": 28,
  Hebrew: 29,
  Lithuanian: 30,
  "Portuguese (Brasil)": 31,
  Bulgarian: 32,
  Estonian: 33,
  Latvian: 34,
  Norwegian: 35,
  Farsi: 36,
};

// Generate expected filenames based on language mapping
const expectedFiles = [
  { name: "MessagesAndLocations_de.xml", language: "German" },
  { name: "MessagesAndLocations_en_gb.xml", language: "English (GB)" },
  { name: "MessagesAndLocations_en_us.xml", language: "English (US)" },
  { name: "MessagesAndLocations_fr.xml", language: "French" },
  { name: "MessagesAndLocations_it.xml", language: "Italian" },
  { name: "MessagesAndLocations_hu.xml", language: "Hungary" },
  { name: "MessagesAndLocations_es.xml", language: "Spain" },
  { name: "MessagesAndLocations_sv.xml", language: "Swedish" },
  { name: "MessagesAndLocations_da.xml", language: "Danish" },
  { name: "MessagesAndLocations_nl.xml", language: "Dutch" },
  { name: "MessagesAndLocations_pt.xml", language: "Portuguese" },
  { name: "MessagesAndLocations_pl.xml", language: "Polish" },
  { name: "MessagesAndLocations_ru.xml", language: "Russian" },
  { name: "MessagesAndLocations_el.xml", language: "Greek" },
  { name: "MessagesAndLocations_zh.xml", language: "Chinese" },
  { name: "MessagesAndLocations_cs.xml", language: "Czech" },
  { name: "MessagesAndLocations_ko.xml", language: "Korean" },
  { name: "MessagesAndLocations_tr.xml", language: "Turkish" },
  { name: "MessagesAndLocations_hr.xml", language: "Croatian" },
  { name: "MessagesAndLocations_fi.xml", language: "Finnish" },
  { name: "MessagesAndLocations_ja.xml", language: "Japanese" },
  { name: "MessagesAndLocations_sk.xml", language: "Sloveccia" },
  { name: "MessagesAndLocations_ro.xml", language: "Romanian" },
  { name: "MessagesAndLocations_vi.xml", language: "Vietnamese" },
  { name: "MessagesAndLocations_ar.xml", language: "Arabic" },
  { name: "MessagesAndLocations_th.xml", language: "Thai" },
  { name: "MessagesAndLocations_sl.xml", language: "Slovenian" },
  { name: "MessagesAndLocations_zh_tw.xml", language: "Chinese (Traditional)" },
  { name: "MessagesAndLocations_he.xml", language: "Hebrew" },
  { name: "MessagesAndLocations_lt.xml", language: "Lithuanian" },
  { name: "MessagesAndLocations_pt_br.xml", language: "Portuguese (Brasil)" },
  { name: "MessagesAndLocations_bg.xml", language: "Bulgarian" },
  { name: "MessagesAndLocations_et.xml", language: "Estonian" },
  { name: "MessagesAndLocations_lv.xml", language: "Latvian" },
  { name: "MessagesAndLocations_no.xml", language: "Norwegian" },
  { name: "MessagesAndLocations_fa.xml", language: "Farsi" },
];

// Default error text file that should always be preserved
const DEFAULT_ERROR_TEXT_FILE = "MessagesAndLocations_en_gb.xml";

// Status ID tag name for publishing sync status
const STATUS_TAG_NAME = "LTA-Settings.application.externalData.statusId";

/**
 * Publishes error text sync status to MQTT
 * @param statusValue 1 = successful download, 0 = no changes, -1 = failed
 * @param mqttClient MQTT client instance (passed as parameter to avoid circular dependency)
 * @param topic MQTT topic for publishing
 */
function publishSyncStatus(
  statusValue: number,
  mqttClient?: any,
  topic?: string
): void {
  try {
    const statusTag = tagStoreInstance.getTagDataByTagName(STATUS_TAG_NAME);

    if (!statusTag) {
      logger.warn(
        `Status tag "${STATUS_TAG_NAME}" not found in TagStore. Cannot publish sync status.`
      );
      return;
    }

    const mqttMessage: IPublishMessage = {
      seq: 1,
      vals: [
        {
          id: statusTag.id,
          val: statusValue,
        },
      ],
    };

    if (
      mqttClient &&
      mqttClient.client &&
      mqttClient.client.connected &&
      topic
    ) {
      mqttClient.publish(topic, mqttMessage as any);
      logger.info(
        `Published error text sync status (${statusValue}) to MQTT topic: ${topic}`
      );
    } else {
      logger.warn(
        "MQTT client not connected or topic not provided. Cannot publish error text sync status."
      );
    }
  } catch (error) {
    logger.error(`Failed to publish error text sync status: ${error}`);
  }
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  download_url: string;
  type: string;
}

/**
 * Downloads a file from a URL using HTTPS
 */
function downloadFile(url: string, githubToken: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const headers: { [key: string]: string } = {
      "User-Agent": "logotronic-adapter",
    };

    // Add authorization header if token is provided
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    https
      .get(url, { headers }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          if (res.headers.location) {
            downloadFile(res.headers.location, githubToken)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error("Redirect without location header"));
          }
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

/**
 * Fetches the list of files from GitHub directory
 */
function fetchGitHubFileList(
  apiUrl: string,
  githubToken: string
): Promise<GitHubFile[]> {
  return new Promise((resolve, reject) => {
    const headers: { [key: string]: string } = {
      "User-Agent": "logotronic-adapter",
    };

    // Add authorization header if token is provided
    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
      logger.info(`Using GitHub token: ${githubToken.substring(0, 10)}...`);
    }

    logger.info(`GitHub API URL: ${apiUrl}`);
    logger.info(`Using authentication: ${githubToken ? "Yes" : "No"}`);

    https
      .get(apiUrl, { headers }, (res) => {
        if (res.statusCode !== 200) {
          let errorData = "";
          res.on("data", (chunk) => {
            errorData += chunk;
          });
          res.on("end", () => {
            logger.error(
              `GitHub API Response (${res.statusCode}): ${errorData}`
            );
            reject(
              new Error(
                `Failed to fetch file list: HTTP ${res.statusCode}. URL: ${apiUrl}`
              )
            );
          });
          return;
        }

        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const files = JSON.parse(data) as GitHubFile[];
            // Filter only .xml files
            const xmlFiles = files.filter(
              (f) => f.type === "file" && f.name.endsWith(".xml")
            );
            resolve(xmlFiles);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Ensures the directory exists
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dirPath}`);
  }
}

/**
 * Gets local files from the errortexts directory
 */
function getLocalFiles(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs.readdirSync(dirPath).filter((file) => file.endsWith(".xml"));
}

/**
 * Downloads and syncs error text files from GitHub
 * Reads configuration from PLC tags
 * @param mqttClient MQTT client instance for publishing status updates
 * @param topic MQTT topic for publishing status
 */
export async function syncErrorTexts(
  mqttClient?: any,
  topic?: string
): Promise<void> {
  // Read configuration from PLC tags
  const machineType = tagStoreInstance.getValueByTagName(
    "LTA-Settings.application.externalData.typeNumber"
  ) as string;

  const githubToken = tagStoreInstance.getValueByTagName(
    "LTA-Settings.application.externalData.github.token"
  ) as string;

  const githubOwner = tagStoreInstance.getValueByTagName(
    "LTA-Settings.application.externalData.github.repo.owner"
  ) as string;

  const githubRepoName = tagStoreInstance.getValueByTagName(
    "LTA-Settings.application.externalData.github.repo.name"
  ) as string;

  // Validate required configuration
  if (!machineType || !githubToken || !githubOwner || !githubRepoName) {
    const missingTags = [];
    if (!machineType) missingTags.push("typeNumber");
    if (!githubToken) missingTags.push("github.token");
    if (!githubOwner) missingTags.push("github.repo.owner");
    if (!githubRepoName) missingTags.push("github.repo.name");

    const errorMsg = `Missing required PLC tags: ${missingTags.join(", ")}`;
    logger.error(errorMsg);
    publishSyncStatus(-1, mqttClient, topic);
    return;
  }

  const errorTextsDir = path.join(__dirname, "../errortexts");

  logger.info(`Starting error text sync for machine type: ${machineType}`);
  logger.info(`GitHub Repository: ${githubOwner}/${githubRepoName}`);

  try {
    // Ensure the directory exists
    ensureDirectoryExists(errorTextsDir);

    // Build GitHub URLs dynamically
    const githubApiUrl = `https://api.github.com/repos/${githubOwner}/${githubRepoName}/contents/${machineType}`;
    const githubRawBaseUrl = `https://raw.githubusercontent.com/${githubOwner}/${githubRepoName}/main`;

    // Fetch the list of available files from GitHub
    logger.info(`Fetching file list from GitHub for ${machineType}...`);
    const remoteFiles = await fetchGitHubFileList(githubApiUrl, githubToken);
    logger.info(`Found ${remoteFiles.length} files on GitHub`);

    // Get local files
    const localFiles = getLocalFiles(errorTextsDir);
    logger.info(`Found ${localFiles.length} local files`);

    // Download new or updated files
    const remoteFileNames = remoteFiles.map((f) => f.name);
    let downloadedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const remoteFile of remoteFiles) {
      const localFilePath = path.join(errorTextsDir, remoteFile.name);
      const fileUrl = `${githubRawBaseUrl}/${machineType}/${remoteFile.name}`;

      try {
        // Check if file exists locally
        const fileExists = fs.existsSync(localFilePath);
        let shouldDownload = !fileExists;

        // If file exists, compare size or SHA (simple check)
        if (fileExists) {
          const localStats = fs.statSync(localFilePath);
          // Download if size is different
          if (localStats.size !== remoteFile.size) {
            shouldDownload = true;
            logger.info(
              `File ${remoteFile.name} has changed (size: ${localStats.size} -> ${remoteFile.size})`
            );
          }
        }

        if (shouldDownload) {
          logger.info(`Downloading ${remoteFile.name}...`);
          const content = await downloadFile(fileUrl, githubToken);
          fs.writeFileSync(localFilePath, content, "utf8");
          logger.info(`Successfully downloaded ${remoteFile.name}`);
          downloadedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        logger.error(`Failed to download ${remoteFile.name}: ${error}`);
        errorCount++;
      }
    }

    // Remove local files that don't exist on GitHub anymore
    // But always preserve the default error text file
    let removedCount = 0;
    for (const localFile of localFiles) {
      if (!remoteFileNames.includes(localFile)) {
        // Never remove the default error text file
        if (localFile === DEFAULT_ERROR_TEXT_FILE) {
          logger.info(
            `Preserving default error text file: ${DEFAULT_ERROR_TEXT_FILE}`
          );
          continue;
        }
        const localFilePath = path.join(errorTextsDir, localFile);
        try {
          fs.unlinkSync(localFilePath);
          logger.info(`Removed obsolete file: ${localFile}`);
          removedCount++;
        } catch (error) {
          logger.error(`Failed to remove ${localFile}: ${error}`);
        }
      }
    }

    logger.info(
      `Error text sync completed: ${downloadedCount} downloaded, ${skippedCount} unchanged, ${removedCount} removed, ${errorCount} errors`
    );

    // Determine status value based on results
    // 1 = successful (files were downloaded or removed)
    // 0 = no changes (all files unchanged)
    // -1 = failed (handled in catch block)
    const hasChanges = downloadedCount > 0 || removedCount > 0;
    const statusValue = hasChanges ? 1 : 0;

    // Publish status to MQTT
    if (mqttClient) {
      publishSyncStatus(statusValue, mqttClient, topic);
    }
  } catch (error) {
    logger.error(`Error text sync failed: ${error}`);
    logger.info(
      `Continuing with existing local files. Default file ${DEFAULT_ERROR_TEXT_FILE} will be used as fallback.`
    );

    // Publish failed status to MQTT
    if (mqttClient) {
      publishSyncStatus(-1, mqttClient, topic);
    }
  }
}
