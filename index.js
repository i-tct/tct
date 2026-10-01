const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const RESTART_DELAY = 2000;

const platformMap = {
  linux: "tct-linux",
  win32: "tct-windows.exe",
  darwin: "tct-macos"
};

const binaryName = platformMap[process.platform] || "tct-linux";
const programPath = path.join(__dirname, binaryName);

const DOWNLOAD_URL = `https://github.com/i-tct/tct/releases/latest/download/${binaryName}`;
const CONFIG_TEMPLATE_URL = "https://gist.githubusercontent.com/i-tct/1433de6fbe3a14f2178e5429b46c31c0/raw";

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        return downloadFile(res.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);

      file.on("finish", () => {
        file.close(() => {
          resolve();
        });
      });

      file.on("error", (err) => {
        fs.unlink(destPath, () => reject(err));
      });
    }).on("error", reject);
  });
}

function downloadBinary() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(programPath)) {
      const stats = fs.statSync(programPath);
      // Basic integrity check
      if (stats.size > 100000) {
        return resolve();
      }
      console.log("Binary is corrupted. Re-downloading...");
      fs.unlinkSync(programPath);
    }

    console.log(`Downloading fresh binary from: ${DOWNLOAD_URL}`);
    downloadFile(DOWNLOAD_URL, programPath)
      .then(() => {
        try {
          if (process.platform !== "win32") {
            fs.chmodSync(programPath, 0o755);
          }
        } catch {}
        console.log("Binary downloaded successfully.");
        resolve();
      })
      .catch(reject);
  });
}

async function generateConfig() {
  const candidates = ["TCTfile", "tctfile", "tctfile.yml", "config.yml"];
  let configFile = "tctfile"; 
  let content = "";
  let found = false;

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      configFile = c;
      content = fs.readFileSync(c, "utf8");
      console.log(`Detected existing config file: ${configFile}`);
      found = true;
      break;
    }
  }

  if (!found) {
    console.log(" No config file found. Downloading default template...");
    try {
      await downloadFile(CONFIG_TEMPLATE_URL, configFile);
      content = fs.readFileSync(configFile, "utf8");
      console.log(" Default config template downloaded.");
    } catch (err) {
      console.error(" Failed to download config template:", err);
    }
  }

  let lines = content ? content.split("\n") : [];

  const legacyKeys = ["SESSION_ID", "PREFIX", "TIMEZONE", "OPENWEATHER_API_KEY", "MISTRAL_API_KEY"];
  lines = lines.filter(line => !legacyKeys.some(k => new RegExp(`^${k}\\s*:`, "i").test(line)));

  const botsIndex = lines.findIndex(line => /^BOTS\s*:/i.test(line));
  if (botsIndex !== -1) {
    let endIndex = botsIndex + 1;
    while (endIndex < lines.length && (lines[endIndex].trim() === "" || lines[endIndex].startsWith(" ") || lines[endIndex].startsWith("-"))) {
      endIndex++;
    }
    lines.splice(botsIndex, endIndex - botsIndex);
  }

  if (process.env.SESSION_ID) {
    lines.push("");
    lines.push("BOTS:");
    const sessions = process.env.SESSION_ID.split(",");
    
    for (const s of sessions) {
      const trimmed = s.trim();
      if (trimmed) {
        // Core ID
        lines.push(`  - SESSION_ID: "${trimmed}"`);
        
        if (process.env.PREFIX) lines.push(`    PREFIX: "${process.env.PREFIX}"`);
        if (process.env.TIMEZONE) lines.push(`    TIMEZONE: "${process.env.TIMEZONE}"`);
        if (process.env.OPENWEATHER_API_KEY) lines.push(`    OPENWEATHER_API_KEY: "${process.env.OPENWEATHER_API_KEY}"`);
        if (process.env.MISTRAL_API_KEY) lines.push(`    MISTRAL_API_KEY: "${process.env.MISTRAL_API_KEY}"`);
      }
    }
  }

  const forceOverrideEnvVars = (key, value) => {
    if (value === undefined || value === null || value === "") return;

    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const newLine = `${key}: "${escaped}"`;
    const regex = new RegExp(`^${key}\\s*:`, "i");
    let keyFound = false;

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        lines[i] = newLine; 
        keyFound = true;
        break;
      }
    }

    if (!keyFound) {
      lines.push(newLine); 
    }
  };

  forceOverrideEnvVars("POSTGRES_URL", process.env.POSTGRES_URL);
  forceOverrideEnvVars("POSTGRES_SYNC_INTERVAL", process.env.POSTGRES_SYNC_INTERVAL);

  const dynamicPort = process.env.PORT || process.env.server_port || process.env.SERVER_PORT;
  if (dynamicPort) {
    forceOverrideEnvVars("SERVER_PORT", dynamicPort);
  }

  fs.writeFileSync(configFile, lines.join("\n"));
}

let child = null;

async function start() {
  try {
    if (process.platform !== "win32") {
      fs.chmodSync(programPath, 0o755);
    }
  } catch {}

  await generateConfig();

  console.log("Starting TCT...");

  child = spawn(programPath, [], {
    stdio: "inherit",
    env: process.env 
  });

  child.on("close", (code) => {
    console.log(`Process exited with code ${code}`);
    restart();
  });

  child.on("error", (err) => {
    console.error("Failed to start:", err);
    restart();
  });
}

function restart() {
  console.log(`Restarting in ${RESTART_DELAY / 1000}s...\n`);
  setTimeout(start, RESTART_DELAY);
}

async function main() {
  try {
    await downloadBinary();
    start();
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

function shutdown() {
  console.log("\nShutting down...");
  if (child) {
    child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main();
