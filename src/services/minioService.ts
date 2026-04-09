import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  endpoint: import.meta.env.VITE_MINIO_ENDPOINT || 'https://minio.nesxp.com',
  region: 'us-east-1', // MinIO doesn't really care about region
  credentials: {
    accessKeyId: import.meta.env.VITE_MINIO_ACCESS_KEY || '',
    secretAccessKey: import.meta.env.VITE_MINIO_SECRET_KEY || '',
  },
  forcePathStyle: true, // Required for MinIO
});

const BUCKET_NAME = import.meta.env.VITE_MINIO_BUCKET || 'app-nesxp';

export const uploadToMinIO = async (file: File): Promise<string> => {
  const fileKey = `${Date.now()}-${file.name}`;
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileKey,
    Body: file,
    ContentType: file.type,
  });

  await s3Client.send(command);
  
  // Return the public URL or key
  return `${import.meta.env.VITE_MINIO_ENDPOINT || 'https://minio.nesxp.com'}/${BUCKET_NAME}/${fileKey}`;
};
