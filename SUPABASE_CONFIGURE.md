# HURIX SUPABASE Configuration

Use this guide when setting up a fresh Supabase project for the Hurix Talent Assessment Platform.

The app uses Supabase Auth for candidate login with:

- Email + password
- Google OAuth
- GitHub OAuth

The backend also uses the Supabase service role key to create/update candidate auth users during registration.

---

## 1. Create Supabase Project

1. Go to [Supabase](https://supabase.com).
2. Create a new project.
3. Choose an organization, project name, region, and database password.
4. Wait for the project to finish provisioning.

After the project is ready, open:

`Project Settings` -> `Data API`

Copy these values:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never put it in frontend env.
- `VITE_SUPABASE_ANON_KEY` is safe for frontend usage.

---

## 2. App URL Configuration

Open:

`Authentication` -> `URL Configuration`

Set `Site URL` to your production app URL:

```text
http://YOUR_EC2_PUBLIC_IP
```

For a domain:

```text
https://your-domain.com
```

Add these `Redirect URLs`:

```text
http://YOUR_EC2_PUBLIC_IP
http://YOUR_EC2_PUBLIC_IP/login
http://localhost:5173
http://localhost:5173/login
```

If using a domain, add:

```text
https://your-domain.com
https://your-domain.com/login
```

Why `/login` matters:

The frontend calls Supabase OAuth with:

```ts
redirectTo: `${window.location.origin}/login`
```

So every deployed origin must allow `/login` in Supabase.

---

## 3. Enable Email + Password Login

Open:

`Authentication` -> `Providers` -> `Email`

Recommended settings:

- Enable `Email` provider.
- Enable email/password sign-in.
- Keep email confirmation based on product needs.

This app creates Supabase email/password users from the backend during registration using:

```env
SUPABASE_SERVICE_ROLE_KEY
```

The local application database remains the source of candidate profile data. Supabase is used for authentication.

---

## 4. Configure Google OAuth

### 4.1 Create Google OAuth Client

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create/select a project.
3. Go to `APIs & Services` -> `OAuth consent screen`.
4. Configure app name, support email, and authorized domains.
5. Go to `Credentials` -> `Create Credentials` -> `OAuth client ID`.
6. Choose `Web application`.

Add Authorized JavaScript origins:

```text
http://YOUR_EC2_PUBLIC_IP
http://localhost:5173
```

For a domain:

```text
https://your-domain.com
```

Add Authorized redirect URI:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Copy:

- Google Client ID
- Google Client Secret

### 4.2 Add Google Provider In Supabase

Open:

`Authentication` -> `Providers` -> `Google`

Set:

```text
Enabled: ON
Client ID: Google OAuth Client ID
Client Secret: Google OAuth Client Secret
```

Save.

### 4.3 App Env Values

For Supabase OAuth buttons, the important values are:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional legacy/direct Google login support:

```env
GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

When Supabase is configured, the candidate login page uses Supabase OAuth buttons for Google and GitHub.

---

## 5. Configure GitHub OAuth

### 5.1 Create GitHub OAuth App

1. Open GitHub.
2. Go to `Settings` -> `Developer settings` -> `OAuth Apps`.
3. Click `New OAuth App`.

Use:

```text
Application name: Hurix Talent Assessment
Homepage URL: http://YOUR_EC2_PUBLIC_IP
Authorization callback URL: https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

For a domain:

```text
Homepage URL: https://your-domain.com
Authorization callback URL: https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Copy:

- GitHub Client ID
- GitHub Client Secret

### 5.2 Add GitHub Provider In Supabase

Open:

`Authentication` -> `Providers` -> `GitHub`

Set:

```text
Enabled: ON
Client ID: GitHub OAuth Client ID
Client Secret: GitHub OAuth Client Secret
```

Save.

---

## 6. Production `.env` Example

On EC2, edit the root `.env` used by Docker Compose:

```env
APP_URL=http://YOUR_EC2_PUBLIC_IP
FRONTEND_URL=http://YOUR_EC2_PUBLIC_IP
VITE_API_URL=/api

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key

GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Then rebuild:

```bash
docker compose -f docker-compose.prod.yml up -d --build api frontend
```

Frontend values beginning with `VITE_` are baked at build time, so changing them requires rebuilding the frontend image.

---

## 7. Local Development `.env`

Frontend:

```env
VITE_API_URL=/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

Backend:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
```

Local redirect URLs must include:

```text
http://localhost:5173
http://localhost:5173/login
```

---

## 8. Validation Checklist

Use this checklist after setup:

- Candidate login page shows `Continue with Google`.
- Candidate login page shows `Continue with GitHub`.
- Google OAuth returns to `/login`, not `localhost` unless testing locally.
- GitHub OAuth returns to `/login`.
- New OAuth user without a local candidate profile redirects to:

```text
/register?email=<email>
```

- Registered candidate can log in with email/password.
- Backend logs do not show `Supabase Auth is not configured`.
- Backend logs do not show `Supabase Auth admin key is not configured`.

---

## 9. Common Issues

### Redirect goes to localhost

Fix Supabase `Authentication` -> `URL Configuration`.

Add production URLs:

```text
http://YOUR_EC2_PUBLIC_IP
http://YOUR_EC2_PUBLIC_IP/login
```

Also update Google/GitHub OAuth app origins/homepage if needed.

### OAuth provider says redirect URI mismatch

Use this callback URL in Google/GitHub:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

### Candidate can authenticate in Supabase but app shows registration required

This is expected for OAuth users who do not yet have a local candidate profile. The app redirects them to registration with prefilled email.

### Email/password login fails after registration

Check that `SUPABASE_SERVICE_ROLE_KEY` is present in backend/EC2 `.env`. The backend needs it to create/update Supabase users during candidate registration.

---

## 10. Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or `VITE_*` variables.
- Rotate keys if they are pasted into public chat, screenshots, or Git history.
- Use HTTPS domain URLs in production when available.
- Keep Supabase redirect URLs limited to trusted domains and local development URLs.
