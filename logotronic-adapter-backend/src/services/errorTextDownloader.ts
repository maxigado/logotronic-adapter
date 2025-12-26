import * as https from "https";
import * as fs from "fs";
import * as path from "path";
import { config } from "../config/config";
import logger from "../utility/logger";

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

const GITHUB_RAW_BASE_URL =
  "https://raw.githubusercontent.com/maxigado/logotronic-adapter-error-texts/main";
const GITHUB_API_BASE_URL =
  "https://api.github.com/repos/maxigado/logotronic-adapter-error-texts/contents";

// Default error text file that should always be preserved
const DEFAULT_ERROR_TEXT_FILE = "MessagesAndLocations_en_gb.xml";

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
function downloadFile(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": "logotronic-adapter" } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          if (res.headers.location) {
            downloadFile(res.headers.location).then(resolve).catch(reject);
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
function fetchGitHubFileList(machineType: string): Promise<GitHubFile[]> {
  return new Promise((resolve, reject) => {
    const url = `${GITHUB_API_BASE_URL}/${machineType}`;

    https
      .get(url, { headers: { "User-Agent": "logotronic-adapter" } }, (res) => {
        if (res.statusCode !== 200) {
          reject(
            new Error(`Failed to fetch file list: HTTP ${res.statusCode}`)
          );
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
 */
export async function syncErrorTexts(): Promise<void> {
  const machineType = config.machinetype;
  const errorTextsDir = path.join(__dirname, "../errortexts");

  logger.info(`Starting error text sync for machine type: ${machineType}`);

  try {
    // Ensure the directory exists
    ensureDirectoryExists(errorTextsDir);

    // Fetch the list of available files from GitHub
    logger.info(`Fetching file list from GitHub for ${machineType}...`);
    const remoteFiles = await fetchGitHubFileList(machineType);
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
      const fileUrl = `${GITHUB_RAW_BASE_URL}/${machineType}/${remoteFile.name}`;

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
          const content = await downloadFile(fileUrl);
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
  } catch (error) {
    logger.error(`Error text sync failed: ${error}`);
    logger.info(
      `Continuing with existing local files. Default file ${DEFAULT_ERROR_TEXT_FILE} will be used as fallback.`
    );
  }
}
