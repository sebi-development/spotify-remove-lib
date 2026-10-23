import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  CLIENT_ID: z.string().min(1),
  REDIRECT_URI: z.url(),
  PORT: z.coerce.number().default(8888),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PRODUCTION_URL: z.string().optional()
})

const result = schema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid environment configuration:');
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const config = result.data