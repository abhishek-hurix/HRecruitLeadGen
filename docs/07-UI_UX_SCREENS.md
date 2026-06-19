# UI/UX Screen Specifications

## Design System

### Colors
- **Background:** `#FFFFFF`, `#F8FAFC` (subtle gray sections)
- **Primary Text:** `#1E293B` (charcoal)
- **Secondary Text:** `#64748B`
- **Accent Gradient:** Cyan `#06B6D4` → Blue `#3B82F6` → Purple `#8B5CF6`
- **Success:** `#10B981`
- **Error:** `#EF4444`
- **Border:** `#E2E8F0`

### Typography
- **Font:** Inter (Google Fonts)
- **Headings:** Semibold 600-700
- **Body:** Regular 400, 16px base

### Components
- Premium cards with `shadow-lg`, `rounded-2xl`, generous padding
- Gradient CTA buttons
- Subtle hover transitions
- Hurix logo top-left in header on all pages

---

## Screen 1: Landing Page
- Hero: "Hurix Talent Assessment Platform"
- Subtitle: Executive hiring excellence
- Features grid (Secure, Timed, Automated Evaluation)
- CTA: "Apply Now" → /register
- Footer: Hurix Digital © 2026

## Screen 2: Registration
- Centered premium card form
- All fields with inline validation
- Drag-drop resume upload zone (PDF only)
- Submit button with loading state
- Success toast → "Check your email"

## Screen 3: Link Expired
- Minimal card with warning icon
- Message: "Assessment Link Expired. Please contact HR."
- Hurix contact info

## Screen 4: Ready For Test
- Welcome banner with candidate name
- Info cards: Language, Questions (10), Duration (60 min)
- Instructions checklist with checkmarks
- Language radio: Python / JavaScript
- "Start Assessment" primary button

## Screen 5: Assessment (Coding)
- **Header:** Logo, timer countdown (red when < 5 min), question progress (3/10)
- **Left Panel (40%):** Question title, description, formats, samples, constraints
- **Right Panel (60%):** Monaco/CodeMirror editor, Run + Submit buttons
- **Question navigator:** Tabs or sidebar for 10 questions
- Copy/paste/right-click disabled

## Screen 6: Thank You
- Large success checkmark animation
- "Assessment Submitted Successfully"
- Candidate name, submission time, status badge
- "Our team will reach out to you."

## Screen 7: Admin Login
- Clean login card, email + password
- Hurix branding

## Screen 8: Admin Dashboard
- Sidebar navigation
- Metric cards row (5 KPIs)
- Recent candidates table
- Charts placeholder for future analytics

## Screen 9: Admin Candidates
- Search bar, filter dropdowns
- Data table with pagination
- Actions: View, Download Resume

## Screen 10: Admin Candidate Detail
- Profile info, assessment status
- Submission review with scores per question
- Expandable code answers

## Screen 11: Admin Questions
- Language tabs (Python / JavaScript)
- CRUD table + modal form for question editor
- Test case manager inline

## Responsive Breakpoints
- Mobile: < 640px (stacked layout, collapsible question panel)
- Tablet: 640-1024px
- Desktop: > 1024px (split panel)
