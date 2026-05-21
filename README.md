# Cooper Fitness CRM

A modern, mobile-friendly CRM web app for fitness coaching businesses. Built with Next.js 16, TypeScript, Tailwind CSS, and Supabase.

## Features

- **Dashboard** — Overview cards for Total Leads, Active Clients, Pending Follow-Ups, and Completed Clients
- **Leads & Clients** — Create, edit, delete, search, and filter contacts with full CRM fields
- **Client Detail Page** — Contact info, timestamped notes, workflow checklists, and follow-ups
- **Follow-Up System** — Set reminders with due dates, dashboard alerts, and email reminders
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

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
RESEND_API_KEY=re_your_resend_key
EMAIL_FROM=onboarding@resend.dev
```

> **Email Reminders:** Sign up at [resend.com](https://resend.com), verify your domain (or use the default `onboarding@resend.dev` for testing), and copy your API key.

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
   - `RESEND_API_KEY`
   - `EMAIL_FROM` (e.g. `onboarding@resend.dev` or your verified domain)
4. Click **Deploy**

### 3. Post-Deploy

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
