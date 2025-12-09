const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Configuration from environment variables
const GIT_REPO_URL = process.env.GIT_REPO_URL || "";
const GIT_BRANCH = process.env.GIT_BRANCH || "main";
const AUTO_UPDATE_ENABLED = process.env.AUTO_UPDATE_ENABLED !== "false";
const GIT_TOKEN = process.env.GIT_TOKEN || "";

// Helper function to execute shell commands
function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      cwd: __dirname,
      stdio: "pipe",
      encoding: "utf-8",
      ...options,
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || "" };
  }
}

// Log function with timestamp
function log(message, level = "INFO") {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// Initialize git repository if needed
function initGitRepo() {
  log("Checking git repository status...");

  const gitDir = path.join(__dirname, ".git");

  if (!fs.existsSync(gitDir)) {
    log("Initializing git repository...");
    const initResult = execCommand("git init");
    if (!initResult.success) {
      log(`Failed to initialize git: ${initResult.error}`, "ERROR");
      return false;
    }
  }

  // Configure git remote
  if (GIT_REPO_URL) {
    log(`Configuring git remote: ${GIT_REPO_URL}`);

    // Remove existing origin if present
    execCommand("git remote remove origin");

    // Add remote with token if provided
    let remoteUrl = GIT_REPO_URL;
    if (GIT_TOKEN && GIT_REPO_URL.includes("github.com")) {
      remoteUrl = GIT_REPO_URL.replace("https://", `https://${GIT_TOKEN}@`);
    }

    const remoteResult = execCommand(`git remote add origin ${remoteUrl}`);
    if (!remoteResult.success) {
      log(`Failed to add remote: ${remoteResult.error}`, "ERROR");
      return false;
    }
  }

  // Set git config for the repository
  execCommand('git config user.email "docker@logotronic-adapter"');
  execCommand('git config user.name "Logotronic Adapter Docker"');

  return true;
}

// Check for updates and pull if available
function checkAndUpdateCode() {
  if (!AUTO_UPDATE_ENABLED) {
    log("Auto-update is disabled. Skipping update check.");
    return { updated: false, reason: "disabled" };
  }

  if (!GIT_REPO_URL) {
    log("No GIT_REPO_URL configured. Skipping update check.");
    return { updated: false, reason: "no-repo-url" };
  }

  log("Fetching latest changes from remote repository...");

  // Fetch latest changes
  const fetchResult = execCommand(`git fetch origin ${GIT_BRANCH} --depth=1`, {
    timeout: 30000,
  });
  if (!fetchResult.success) {
    log(`Failed to fetch from remote: ${fetchResult.error}`, "WARN");
    return { updated: false, reason: "fetch-failed", error: fetchResult.error };
  }

  // Get current commit hash
  const localCommitResult = execCommand("git rev-parse HEAD");
  const localCommit = localCommitResult.success
    ? localCommitResult.output.trim()
    : "";

  // Get remote commit hash
  const remoteCommitResult = execCommand(`git rev-parse origin/${GIT_BRANCH}`);
  const remoteCommit = remoteCommitResult.success
    ? remoteCommitResult.output.trim()
    : "";

  log(`Local commit: ${localCommit || "unknown"}`);
  log(`Remote commit: ${remoteCommit || "unknown"}`);

  // Check if update is needed
  if (!remoteCommit || localCommit === remoteCommit) {
    log("Code is up to date. No updates needed.");
    return { updated: false, reason: "up-to-date", commit: localCommit };
  }

  log("New updates detected! Pulling changes...");

  // Check if package.json will change
  const packageJsonChanged = checkFileChanged(
    "package.json",
    `origin/${GIT_BRANCH}`
  );

  // Pull changes
  const pullResult = execCommand(`git pull origin ${GIT_BRANCH}`);
  if (!pullResult.success) {
    log(`Failed to pull changes: ${pullResult.error}`, "ERROR");
    return { updated: false, reason: "pull-failed", error: pullResult.error };
  }

  log("Successfully pulled latest changes.");

  // Install dependencies if package.json changed
  if (packageJsonChanged) {
    log("package.json changed. Running npm install...");
    const installResult = execCommand("npm install");
    if (!installResult.success) {
      log(`Failed to install dependencies: ${installResult.error}`, "ERROR");
      return {
        updated: false,
        reason: "install-failed",
        error: installResult.error,
      };
    }
    log("Dependencies installed successfully.");
  }

  // Rebuild the application
  log("Building application...");
  const buildResult = execCommand("npm run build");
  if (!buildResult.success) {
    log(`Failed to build application: ${buildResult.error}`, "ERROR");
    return { updated: false, reason: "build-failed", error: buildResult.error };
  }

  log("Application built successfully.");

  return {
    updated: true,
    previousCommit: localCommit,
    currentCommit: remoteCommit,
    packageJsonChanged,
  };
}

// Check if a specific file changed between current and target commit
function checkFileChanged(filename, targetRef) {
  const diffResult = execCommand(`git diff HEAD ${targetRef} --name-only`);
  if (diffResult.success) {
    const changedFiles = diffResult.output.split("\n").map((f) => f.trim());
    return changedFiles.includes(filename);
  }
  return false;
}

// Save update information to file
function saveUpdateInfo(updateResult) {
  const updateInfo = {
    timestamp: new Date().toISOString(),
    ...updateResult,
  };

  const infoPath = path.join(__dirname, "last-update.json");
  try {
    fs.writeFileSync(infoPath, JSON.stringify(updateInfo, null, 2));
    log("Update info saved to last-update.json");
  } catch (error) {
    log(`Failed to save update info: ${error.message}`, "WARN");
  }
}

// Main startup function
async function startup() {
  log("========================================");
  log("Logotronic Adapter - Startup Script");
  log("========================================");

  try {
    // Initialize git repository
    const gitInitialized = initGitRepo();

    // Check for updates and pull if available
    const updateResult = checkAndUpdateCode();

    // Save update information
    saveUpdateInfo(updateResult);

    if (updateResult.updated) {
      log("Application updated successfully. Starting with new code...");
    } else {
      log(
        `Starting application with existing code (${updateResult.reason})...`
      );
    }

    log("========================================");

    // Start the application
    require("./index.js");
  } catch (error) {
    log(`Startup error: ${error.message}`, "ERROR");
    log(error.stack, "ERROR");
    process.exit(1);
  }
}

// Run startup
startup();
