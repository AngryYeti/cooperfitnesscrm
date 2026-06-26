import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import { verifyToken, getClientIpFromHeaders } from "@/lib/utils/ip-session";

export async function createClient() {
  const cookieStore = await cookies();
  const reqHeaders = await headers();

  // Check if custom IP session is valid
  const customCookie = cookieStore.get("cooper_fitness_session")?.value;
  const ip = getClientIpFromHeaders(reqHeaders);

  let hasValidIpSession = false;
  let ipSessionEmail = "";

  if (customCookie) {
    const session = await verifyToken(customCookie);
    if (session && session.ip === ip && session.expiresAt > Date.now()) {
      hasValidIpSession = true;
      ipSessionEmail = session.email;
    }
  }

  // If we have a valid custom IP session, but no standard Supabase session,
  // we can return an admin client (bypassing RLS) so database queries succeed!
  if (hasValidIpSession) {
    const adminClient = createAdminClient();
    
    adminClient.auth.getUser = async () => {
      return {
        data: {
          user: {
            id: "ip-session-mocked-user",
            email: ipSessionEmail,
            user_metadata: {
              name: ipSessionEmail.split("@")[0],
            },
            app_metadata: {},
            aud: "authenticated",
            created_at: new Date().toISOString(),
          } as unknown as User,
        },
        error: null,
      };
    };

    return adminClient;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
