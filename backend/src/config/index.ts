import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const backendRoot = path.resolve(__dirname, '../..');
const backendEnv = path.join(backendRoot, '.env');
const rootEnv = path.join(backendRoot, '..', '.env');

if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv, override: true });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv, override: true });
} else {
  dotenv.config({ override: true });
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  jwt: {
    assessmentSecret: process.env.JWT_ASSESSMENT_SECRET || 'dev-assessment-secret-change-me',
    adminSecret: process.env.JWT_ADMIN_SECRET || 'dev-admin-secret-change-me',
    assessmentTokenExpiryDays: parseInt(process.env.ASSESSMENT_TOKEN_EXPIRY_DAYS || '7', 10),
    candidatePortalExpiryDays: parseInt(process.env.CANDIDATE_PORTAL_EXPIRY_DAYS || '30', 10),
    adminExpiryHours: parseInt(process.env.ADMIN_TOKEN_EXPIRY_HOURS || '8', 10),
    emailVerificationExpiryHours: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_HOURS || '24', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    scoringModel: process.env.AI_SCORING_MODEL || 'gpt-4o-mini',
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    mockMode: process.env.EMAIL_MOCK_MODE === 'true',
    from: process.env.EMAIL_FROM || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  upload: {
    maxFileSizeMb: parseInt(process.env.MAX_RESUME_SIZE_MB || '10', 10),
    uploadDir: process.env.UPLOAD_DIR || './uploads/resumes',
  },
  assessment: {
    questionCount: parseInt(process.env.ASSESSMENT_QUESTION_COUNT || '10', 10),
    durationMinutes: parseInt(process.env.ASSESSMENT_DURATION_MINUTES || '15', 10),
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    localDir: process.env.UPLOAD_DIR || './uploads/resumes',
    s3: {
      bucket: process.env.S3_BUCKET || '',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.S3_ENDPOINT || '',
    },
  },
  sandbox: {
    pythonImage: process.env.SANDBOX_PYTHON_IMAGE || 'hurix-sandbox-python',
    nodeImage: process.env.SANDBOX_NODE_IMAGE || 'hurix-sandbox-node',
    memoryLimit: process.env.SANDBOX_MEMORY_LIMIT || '128m',
    cpuLimit: process.env.SANDBOX_CPU_LIMIT || '0.5',
    timeoutSeconds: parseInt(process.env.SANDBOX_TIMEOUT_SECONDS || '10', 10),
    mockMode: process.env.SANDBOX_MOCK_MODE === 'true',
  },
  admin: {
    defaultEmail: process.env.ADMIN_EMAIL || 'admin@hurixdigital.com',
    defaultPassword: process.env.ADMIN_PASSWORD || 'HurixAdmin@2026',
  },
};
