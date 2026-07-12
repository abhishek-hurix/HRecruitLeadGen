export type Language = 'PYTHON' | 'JAVASCRIPT';

export interface Question {
  id: string;
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  sampleInput: string;
  sampleOutput: string;
  constraints: string;
  starterCode: string;
  answerMode: 'CODE' | 'COMPREHENSIVE' | 'MCQ';
  mcqOptions?: string[] | null;
  topic?: string;
  language?: Language;
  order: number;
}

export interface AssessmentSession {
  assessmentId: string;
  language: Language;
  expiresAt: string;
  questions: Question[];
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string;
}

export type JourneyStatus =
  | 'REGISTERED'
  | 'EMAIL_SENT'
  | 'VERIFIED'
  | 'STARTED'
  | 'SUBMITTED'
  | 'EXPIRED'
  | 'REJECTED';

export type SelectionStatus =
  | 'PENDING'
  | 'SHORTLISTED'
  | 'INTERVIEWED'
  | 'SELECTED'
  | 'REJECTED';

export interface Candidate {
  id: string;
  applicationId?: string;
  fullName: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  referralCode?: string;
  emailVerified?: boolean;
  journeyStatus: JourneyStatus;
  assessmentStatus: string;
  appliedRole?: string | null;
  appliedCountry?: string | null;
  appliedCompensation?: string | null;
  phoneCountry?: string | null;
  phoneCountryIso?: string | null;
  countryName?: string | null;
  dialCode?: string | null;
  countryCode?: string | null;
  experienceCategory?: string | null;
  experienceLabel?: string | null;
  yearsOfExperience?: number | null;
  score: number | null;
  scoreLabel?: string | null;
  roleLabel?: string | null;
  selectionStatus?: SelectionStatus;
  rejectionReason?: string | null;
  rejectedAt?: string | null;
  deletedAt?: string | null;
  submittedAt: string | null;
  createdAt: string;
  lastActivityAt?: string | null;
  lastActivityType?: string | null;
  ownerAdminId?: string | null;
  owner?: {
    id: string;
    email: string;
    role: string;
  } | null;
}

export interface DashboardMetrics {
  totalCandidates: number;
  completedAssessments: number;
  averageScore: string;
  registered?: number;
  verified?: number;
  startedAssessment?: number;
  submittedAssessment?: number;
  selected?: number;
  rejected?: number;
  totalAdmins?: number;
  candidatesByExperience?: Array<{ category: string; count: number }>;
}

export interface CandidateDashboard {
  profile: {
    fullName: string;
    email: string;
    phone: string;
    countryCode: string;
    phoneCountry: string;
    phoneNumber: string;
    yearsOfExperience: number | null;
    experienceCategory: string | null;
    experienceLabel: string;
    linkedinUrl: string;
    referralCode: string | null;
    resumeUploaded: boolean;
    resumes: Array<{
      id: string;
      fileName: string;
      isPrimary: boolean;
      uploadedAt: string;
    }>;
  };
  verification: {
    emailVerified: boolean;
    verifiedAt: string | null;
    verificationSentAt: string | null;
    resendsRemaining: number;
    canResend: boolean;
  };
  appliedPosition: {
    roleId: string | null;
    roleName: string | null;
    country: string | null;
    compensation: string | null;
    skills: string[];
    selectedAt: string | null;
  } | null;
  appliedPositions?: Array<{
    roleId: string | null;
    roleName: string | null;
    country: string | null;
    compensation: string | null;
    skills: string[];
    selectedAt: string | null;
  }>;
  timeline: {
    registered: boolean;
    emailVerified: boolean;
    assessmentStarted: boolean;
    assessmentSubmitted: boolean;
  };
  assessment: {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';
    date: string | null;
    score: number | null;
    passedTests: number;
    failedTests: number;
    hasCompleted: boolean;
    hasInProgress: boolean;
  };
  journeyStatus: JourneyStatus;
  history: Array<{
    id: string;
    jobRoleId: string | null;
    roleName: string | null;
    skills: string[];
    language: Language;
    score: number;
    passedQuestions: number;
    totalQuestions: number;
    submittedAt: string;
    result: string;
  }>;
}
