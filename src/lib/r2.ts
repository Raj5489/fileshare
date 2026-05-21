import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.warn(
    "[R2] Missing environment variables. R2 operations will fail."
  );
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 600
) {
  return getSignedUrl(
    r2,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn }
  );
}

export async function getSignedDownloadUrl(
  key: string,
  filenameOrExpiresIn?: string | number,
  expiresIn = 900
) {
  let filename: string | undefined;
  let actualExpiresIn = expiresIn;

  if (typeof filenameOrExpiresIn === "number") {
    actualExpiresIn = filenameOrExpiresIn;
  } else if (typeof filenameOrExpiresIn === "string") {
    filename = filenameOrExpiresIn;
  }

  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${filename.replace(/[^ \x20-\x7e]/g, "_").replace(/"/g, '\\"')}"; filename*=UTF-8''${encodeURIComponent(filename)}`
        : undefined,
    }),
    { expiresIn: actualExpiresIn }
  );
}

export async function deleteFromR2(key: string) {
  return r2.send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })
  );
}
