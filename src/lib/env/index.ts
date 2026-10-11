import { z } from 'zod';
import { config } from 'dotenv';
config();

const envSchema = z.object({
  NEXT_PUBLIC_SEPOLIA_RPC_URL: z.string().url("Must be a valid URL for Sepolia RPC"),
  SEPOLIA_DEPLOYER_PRIVATE_KEY: z.string().min(64, "Must be a valid private key"),
  NEXT_PUBLIC_STORAGE_PROVIDER_URL: z.string().url("Must be a valid IPFS/storage URL").optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment variables');
}

export const env = _env.data;
