# Google Authentication Setup

Follow these steps to enable Google sign-in through Supabase for HyperMemo.

## 1. Create an OAuth client
1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) for the project tied to HyperMemo.
2. Create a new **OAuth 2.0 Client ID** (type *Web application*).
3. Add the following redirect URIs:
   - `https://<YOUR_EXTENSION_ID>.chromiumapp.org/` (Chrome Identity flow)
   - `https://<PROJECT_REF>.supabase.co/auth/v1/callback` (Supabase hosted callback)
4. Copy the generated **Client ID** and **Client Secret**.

## 2. Configure Supabase Auth
1. Supabase Dashboard → Authentication → Providers → Google.
2. Toggle Google **on**, paste the Client ID and Client Secret, then save.
3. (Optional) verify “Site URL” in Authentication → URL Configuration matches your deployed domain.

## 3. Expose the client ID to the extension
1. In `.env` / `.env.local`, set `VITE_GOOGLE_OAUTH_CLIENT_ID=<Client ID>`.
2. Rebuild or restart the dev server so the popup service picks up the value.

## 4. Verify both login paths
- **Chrome extension:** “Sign in with Google” triggers `chrome.identity.launchWebAuthFlow`, which returns an ID token exchanged via `supabase.auth.signInWithIdToken`.
- **Non-extension fallback:** Supabase falls back to `signInWithOAuth('google')`, redirecting through `https://<PROJECT_REF>.supabase.co/auth/v1/callback`.
