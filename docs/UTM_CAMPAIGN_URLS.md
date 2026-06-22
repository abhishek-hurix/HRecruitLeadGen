# UTM Campaign Tracking URLs

Use these links in YouTube, email, LinkedIn, and other campaigns. The platform tracks visitors on the **landing page** (`/`) and links attribution when candidates register.

## Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `utm_source` | Traffic source | `youtube`, `email`, `linkedin` |
| `utm_medium` | Channel type | `video`, `email`, `social` |
| `utm_campaign` | Campaign name (use same across channels for comparison) | `ai_hiring_2026` |
| `utm_term` | Keyword (optional) | `genai` |
| `utm_content` | Creative / placement (optional) | `shorts`, `newsletter_march` |

Values are stored **lowercase** in analytics.

---

## Production URLs

**Live site:** [https://candidates.hurixsystems.com/](https://candidates.hurixsystems.com/)

### YouTube (video description / pinned comment)

```
https://candidates.hurixsystems.com/?utm_source=youtube&utm_medium=video&utm_campaign=ai_hiring_2026&utm_term=genai&utm_content=shorts
```

**Variants:**

| Placement | `utm_content` |
|-----------|---------------|
| YouTube Shorts | `shorts` |
| Long-form video | `longform` |
| Community post | `community_post` (`utm_medium=community`) |

### Email campaign (CTA button)

```
https://candidates.hurixsystems.com/?utm_source=email&utm_medium=email&utm_campaign=ai_hiring_2026&utm_content=newsletter_march
```

### LinkedIn (post / ad / InMail)

```
https://candidates.hurixsystems.com/?utm_source=linkedin&utm_medium=social&utm_campaign=ai_hiring_2026&utm_content=post_hiring
```

**Variants:**

| Placement | `utm_content` |
|-----------|---------------|
| Organic post | `post_hiring` |
| Sponsored ad | `sponsored_ad` |
| Carousel ad | `carousel_ad` |

---

## Local development URLs

### YouTube

```
http://localhost:5173/?utm_source=youtube&utm_medium=video&utm_campaign=ai_hiring_2026&utm_term=genai&utm_content=shorts
```

### Email

```
http://localhost:5173/?utm_source=email&utm_medium=email&utm_campaign=ai_hiring_2026&utm_content=newsletter_march
```

### LinkedIn

```
http://localhost:5173/?utm_source=linkedin&utm_medium=social&utm_campaign=ai_hiring_2026&utm_content=post_hiring
```

---

## Naming conventions

Use a consistent pattern so **Admin → Analytics** can compare channels:

```
utm_source   = platform   (youtube | email | linkedin | google | facebook)
utm_medium   = format     (video | email | social | cpc | referral)
utm_campaign = initiative (ai_hiring_2026 | campus_drive_q2)
utm_content  = creative   (shorts_01 | email_cta_top | linkedin_carousel)
```

**Tip:** Use the same `utm_campaign` across YouTube, email, and LinkedIn to compare which channel converts best.

---

## How tracking works

1. Visitor lands on `/` with UTM params → `POST /api/visitors/track`
2. Params stored as first-touch and last-touch attribution
3. Candidate registers with linked `visitorId` → attribution copied to profile
4. View results: **Admin → Marketing Analytics** (`/admin/analytics`)

---

## Verify tracking

1. Open a UTM URL in the browser
2. DevTools → Network → confirm `POST /api/visitors/track` with UTM fields
3. Complete registration
4. Check **Admin → Analytics** for source and campaign breakdown

---

## API reference

`POST /api/visitors/track` accepts:

```json
{
  "visitorId": "uuid",
  "landingPage": "https://candidates.hurixsystems.com/?utm_source=youtube&...",
  "utm_source": "youtube",
  "utm_medium": "video",
  "utm_campaign": "ai_hiring_2026",
  "utm_term": "genai",
  "utm_content": "shorts",
  "deviceType": "DESKTOP"
}
```

See `docs/06-API_CONTRACTS.md` for full visitor and analytics API documentation.
