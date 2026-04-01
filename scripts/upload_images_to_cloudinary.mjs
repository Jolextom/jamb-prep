import { createHash } from "crypto";
import { access, readdir, readFile } from "fs/promises";
import path from "path";
import process from "process";

const DEFAULT_SOURCE_DIR = path.resolve("public/images");
const DEFAULT_FOLDER =
  process.env.CLOUDINARY_FOLDER || "jambite-question-images";

function parseArgs(argv) {
  const args = {
    file: "",
    dir: DEFAULT_SOURCE_DIR,
    folder: DEFAULT_FOLDER,
    dryRun: false,
    all: false,
    concurrency: 4,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--file" && argv[index + 1]) {
      args.file = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--dir" && argv[index + 1]) {
      args.dir = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--folder" && argv[index + 1]) {
      args.folder = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--concurrency" && argv[index + 1]) {
      const parsedConcurrency = Number.parseInt(argv[index + 1], 10);
      if (Number.isFinite(parsedConcurrency) && parsedConcurrency > 0) {
        args.concurrency = parsedConcurrency;
      }
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--all") {
      args.all = true;
    }
  }

  return args;
}

function buildSignature(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    )
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function buildPublicId(fileName) {
  return stripExtension(fileName).replace(/\\/g, "/");
}

async function getFilesFromDir(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dirPath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function uploadOne(
  filePath,
  { cloudName, apiKey, apiSecret, folder, dryRun },
) {
  const fileName = path.basename(filePath);
  const publicId = buildPublicId(fileName);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = buildSignature(
    {
      folder,
      public_id: publicId,
      timestamp,
      unique_filename: "false",
      overwrite: "true",
    },
    apiSecret,
  );

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  if (dryRun) {
    return {
      filePath,
      uploadUrl,
      publicId,
      folder,
      dryRun: true,
    };
  }

  const formData = new FormData();
  formData.append("file", new Blob([await readFile(filePath)]), fileName);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("folder", folder);
  formData.append("public_id", publicId);
  formData.append("unique_filename", "false");
  formData.append("overwrite", "true");
  formData.append("signature", signature);

  const response = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || `Upload failed for ${fileName}`);
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET",
    );
  }

  const targetFiles = args.file
    ? [path.resolve(args.file)]
    : await getFilesFromDir(path.resolve(args.dir));

  if (targetFiles.length === 0) {
    throw new Error(`No files found in ${args.dir}`);
  }

  if (!args.all) {
    const filePath = targetFiles[0];
    await access(filePath);
    const result = await uploadOne(filePath, {
      cloudName,
      apiKey,
      apiSecret,
      folder: args.folder,
      dryRun: args.dryRun,
    });

    if (args.dryRun) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(
      JSON.stringify(
        {
          file: path.basename(filePath),
          public_id: result.public_id,
          secure_url: result.secure_url,
          bytes: result.bytes,
        },
        null,
        2,
      ),
    );
    return;
  }

  let nextIndex = 0;
  let uploadedCount = 0;
  let failedCount = 0;
  const workerCount = Math.min(args.concurrency, targetFiles.length);

  async function runWorker() {
    while (true) {
      const fileIndex = nextIndex;
      nextIndex += 1;

      if (fileIndex >= targetFiles.length) {
        return;
      }

      const filePath = targetFiles[fileIndex];
      const fileName = path.basename(filePath);

      try {
        await access(filePath);
        const result = await uploadOne(filePath, {
          cloudName,
          apiKey,
          apiSecret,
          folder: args.folder,
          dryRun: args.dryRun,
        });

        if (args.dryRun) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(
            JSON.stringify(
              {
                file: fileName,
                public_id: result.public_id,
                secure_url: result.secure_url,
                bytes: result.bytes,
              },
              null,
              2,
            ),
          );
        }

        uploadedCount += 1;
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          JSON.stringify(
            {
              file: fileName,
              error: message,
            },
            null,
            2,
          ),
        );
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  console.log(
    JSON.stringify(
      {
        folder: args.folder,
        total: targetFiles.length,
        uploaded: uploadedCount,
        failed: failedCount,
        concurrency: workerCount,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
