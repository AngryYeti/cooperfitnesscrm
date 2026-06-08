# Cooper Fitness CRM

A modern, mobile-friendly CRM web app for fitness coaching businesses. Built with Next.js 16, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Dashboard** — Overview cards for Total Leads, Active Clients, Pending Follow-Ups, and Completed Clients
- **Leads & Clients** — Create, edit, delete, search, and filter contacts with full CRM fields
- **Client Detail Page** — Contact info, timestamped notes, workflow checklists, and follow-ups
- **Follow-Up System** — Set reminders with due dates, dashboard alerts, and automated email reminders (9AM & 1PM daily)
- **Checklist Templates** — Custom onboarding and workflow checklists with toggleable items
- **Activity Log** — Track all changes and interactions automatically
- **Tags & Filters** — Organize contacts with tags and status filters
- **CSV Export** — Export your contacts at any time
- **Dark/Light Mode** — Premium modern UI with theme support
- **Responsive** — Fully optimized for desktop and mobile

## Tech Stack

- **Next.js 16** App Router
- **TypeScript**
- **Tailwind CSS v4**
- **Supabase** (Auth + Database)
- **Radix UI** primitives
- **next-themes** for dark/light mode

## Local Setup

### 1. Prerequisites

- Node.js 18+
- npm
- A Supabase account (free tier works)

### 2. Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **Project Settings > API** and copy:
   - `Project URL`
   - `anon public` API key
3. Go to the **SQL Editor** and run the contents of `supabase/schema.sql`
4. Go to **Authentication > Sign Up / Log In**, enable **Email** provider
5. Create your admin user via **Authentication > Users > Add User** or sign up through the app

### 3. Environment Variables

Create a `.env.local` file in the project root (see `.env.example` for the full list):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=465
ZOHO_SMTP_SECURE=true
ZOHO_SMTP_USER=your-email@cooper.fitness
ZOHO_SMTP_PASSWORD=your-zoho-app-password
EMAIL_FROM="Cooper Fitness <noreply@cooper.fitness>"
CRON_SECRET=any-random-secret-string
DOCUSEAL_API_TOKEN=your-docuseal-token
DOCUSEAL_API_URL=https://api.docuseal.co
```

> **Service Role Key:** Go to Supabase → Project Settings → API → `service_role key` (keep this secret — it bypasses RLS). Needed for the website lead webhook.

> **Zoho SMTP Setup (no DNS required):**
> 1. Log in at your Zoho account (region-specific: `accounts.zoho.com`, `.eu`, `.in`, `.com.au`, `.jp`, or `.ca`)
> 2. Enable **2-Step Verification** under Security
> 3. Go to **Security → App Passwords** and generate a new app password for "Mail / SMTP"
> 4. Use that as `ZOHO_SMTP_PASSWORD` (keep it secret)
> 5. `ZOHO_SMTP_USER` is your full **Zoho** email address (NOT a Gmail/Yahoo alias — Zoho SMTP rejects foreign addresses with 535)
> 6. `EMAIL_FROM` is what recipients see — the address part must match `ZOHO_SMTP_USER` or an alias you've configured in Zoho
> 7. After deploying, hit `POST /api/email/test` to verify the connection
>
> **SMTP host by account type:**
> - Personal/free Zoho account: `smtp.zoho.com` (any region)
> - Zoho Workplace / organization account: `smtp.zohocloud.<region>` — e.g. `smtp.zohocloud.ca` for Canada, `.eu` for Europe
> - Check your Zoho **Settings → Mail → POP/IMAP** to see the exact outgoing SMTP server for your account

### 4. Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`. Sign in with your Supabase user credentials.

## Vercel Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and click **Add New Project**
2. Import your GitHub repository
3. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ZOHO_SMTP_USER`
   - `ZOHO_SMTP_PASSWORD`
   - `EMAIL_FROM`
   - `CRON_SECRET` (any random string)
4. Click **Deploy**

### 3. Enable Automated Email Reminders (GitHub Actions)

The repo includes a free cron job that sends reminder emails at **9AM and 1PM ET** every day.

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add:
   - `CRON_SECRET` — same random string you used in Vercel
   - `VERCEL_DOMAIN` — your live URL (e.g. `https://cooperfitnesscrm.vercel.app`)

That's it. GitHub Actions will automatically call your API twice daily.

### 4. Post-Deploy

After the first deploy, make sure your Supabase project URL is added to:
- **Supabase > Authentication > URL Configuration > Redirect URLs**: `https://your-vercel-domain.vercel.app/**`
- **Supabase > Authentication > URL Configuration > Site URL**: `https://your-vercel-domain.vercel.app`

## Project Structure

```
src/
  app/
    (auth)/login/page.tsx        # Login page
    (dashboard)/
      page.tsx                   # Dashboard
      clients/page.tsx           # Client list
      clients/[id]/page.tsx      # Client detail
      follow-ups/page.tsx        # Follow-ups
      settings/page.tsx          # Settings / templates
  components/
    ui/                          # Reusable UI primitives
    layout/                      # Sidebar, Header
    forms/                       # ContactForm, FollowUpForm
    clients/                     # ContactDetailView
  lib/
    actions/                     # Server Actions
    supabase/                    # Client, server, middleware
    types.ts                     # TypeScript types
```

## Database Schema

The schema includes:
- `contacts` — client and lead records
- `notes` — timestamped notes per contact
- `follow_ups` — reminders with due dates
- `checklist_templates` — reusable workflow templates
- `client_checklists` — assigned checklists per client
- `activities` — auto-generated activity log

All tables have Row Level Security (RLS) enabled and are restricted to authenticated users only.
