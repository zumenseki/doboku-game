import 'server-only'
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Env } from '@/lib/env'

/** presigned URL の有効期限（秒）= 15分 */
export const PRESIGN_EXPIRES_IN = 15 * 60

let cached: S3Client | null = null

function client(): S3Client {
  if (cached) return cached
  const env = r2Env()
  cached = new S3Client({
    region: 'auto',
    endpoint: `https://${env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  })
  return cached
}

/** アップロード用 presigned PUT URL（15分） */
export async function presignPut(
  objectKey: string,
  contentType: string,
  contentLength?: number,
): Promise<string> {
  const { bucket } = r2Env()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return getSignedUrl(client(), command, { expiresIn: PRESIGN_EXPIRES_IN })
}

/** 閲覧用 presigned GET URL（15分） */
export async function presignGet(objectKey: string): Promise<string> {
  const { bucket } = r2Env()
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  return getSignedUrl(client(), command, { expiresIn: PRESIGN_EXPIRES_IN })
}

/** 複数キーをまとめて削除（1回あたり最大1000件） */
export async function deleteObjects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0
  const { bucket } = r2Env()
  let deleted = 0
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000)
    const res = await client().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    )
    deleted += chunk.length - (res.Errors?.length ?? 0)
  }
  return deleted
}

export const objectKeys = {
  drawing: (siteId: string) => `sites/${siteId}/drawing.pdf`,
  photo: (reportId: string, id: string) => `reports/${reportId}/${id}.webp`,
}

/** 写真キーが「この日報のもの」かを検証する（他日報のキーを紐付けられないように） */
export function isPhotoKeyOf(objectKey: string, reportId: string): boolean {
  return objectKey.startsWith(`reports/${reportId}/`)
}
