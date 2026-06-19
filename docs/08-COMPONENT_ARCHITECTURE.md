# Component Architecture (Frontend)

```
src/
├── main.tsx
├── App.tsx
├── api/
│   ├── client.ts          # Axios instance + interceptors
│   ├── registration.ts
│   ├── assessment.ts
│   └── admin.ts
├── hooks/
│   ├── useAssessmentToken.ts
│   ├── useTimer.ts
│   └── useSecureEditor.ts   # copy/paste/cut/right-click block
├── components/
│   ├── layout/
│   │   ├── Header.tsx       # Hurix logo + nav
│   │   ├── Footer.tsx
│   │   └── AdminLayout.tsx  # Sidebar + content
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── FileUpload.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   └── LoadingSpinner.tsx
│   ├── assessment/
│   │   ├── QuestionPanel.tsx
│   │   ├── CodeEditor.tsx
│   │   ├── Timer.tsx
│   │   ├── QuestionNav.tsx
│   │   └── RunResults.tsx
│   └── admin/
│       ├── MetricCard.tsx
│       ├── CandidateTable.tsx
│       ├── QuestionForm.tsx
│       └── SubmissionReview.tsx
├── pages/
│   ├── LandingPage.tsx
│   ├── RegisterPage.tsx
│   ├── VerifyPage.tsx
│   ├── LinkExpiredPage.tsx
│   ├── ReadyPage.tsx
│   ├── AssessmentPage.tsx
│   ├── ThankYouPage.tsx
│   └── admin/
│       ├── LoginPage.tsx
│       ├── DashboardPage.tsx
│       ├── CandidatesPage.tsx
│       ├── CandidateDetailPage.tsx
│       └── QuestionsPage.tsx
├── types/
│   └── index.ts
└── utils/
    ├── validation.ts
    └── format.ts
```

## State Management
- **React Query:** All API data (candidates, questions, dashboard)
- **URL State:** Assessment token in query param `?token=`
- **Local State:** Editor content, current question index, timer

## Key Patterns
- Protected routes via `AssessmentGuard` (validates token)
- `useSecureEditor` hook centralizes security rules 4-6, 8
- Optimistic UI for admin question edits
- Error boundaries on assessment page
