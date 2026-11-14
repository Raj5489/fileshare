import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
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
  expiresIn = 3600
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

// ── Multipart upload helpers ──────────────────────────────────────────────────

export async function createMultipartUpload(
  key: string,
  contentType: string
): Promise<string> {
  const result = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    })
  );
  if (!result.UploadId) throw new Error("[R2] Failed to create multipart upload");
  return result.UploadId;
}

export async function getPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    r2,
    new UploadPartCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn }
  );
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
) {
  return r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    })
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  return r2.send(
    new AbortMultipartUploadCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      UploadId: uploadId,
    })
  );
}

// ── Object inspection helpers (security / magic-byte checks) ────────────────

/** Read the first `length` bytes of an object as a Uint8Array (best-effort). */
export async function readObjectRange(
  key: string,
  length: number
): Promise<Uint8Array | null> {
  try {
    const res = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Range: `bytes=0-${length - 1}`,
      })
    );
    const body = res.Body as ReadableStream<Uint8Array> | undefined;
    if (!body) return null;
    const reader = body.getReader();
    const { value, done } = await reader.read();
    return done || !value ? null : value.slice(0, length);
  } catch {
    return null;
  }
}

const EXECUTABLE_MAGIC: Array<{ bytes: number[]; label: string }> = [
  { bytes: [0x4d, 0x5a], label: "Windows PE executable (MZ)" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: "ELF executable" },
  { bytes: [0xcf, 0xfa, 0xed, 0xfe], label: "Mach-O executable" },
];

/** True if the leading bytes match a known executable format. */
export function isExecutableMagic(head: Uint8Array): boolean {
  for (const { bytes } of EXECUTABLE_MAGIC) {
    if (head.length >= bytes.length) {
      let matches = true;
      for (let i = 0; i < bytes.length; i++) {
        if (head[i] !== bytes[i]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
  }
  return false;
}

