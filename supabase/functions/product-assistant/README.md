# Product assistant Edge Function

The function uses the `GEMINI_API_KEY` secret already configured in Supabase. It requires a signed-in Supabase user, reads active in-stock products under that user's normal RLS permissions, and calls Gemini without storing conversation turns (`store: false`).

## Deploy

From the repository root, link the Supabase CLI to the project if it is not linked yet, then deploy:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy product-assistant
```

Keep `GEMINI_API_KEY` in **Supabase Dashboard → Edge Functions → Secrets**. Do not add it to an `EXPO_PUBLIC_*` variable or commit it to a local env file.

After deployment, sign in to the app, open **Tìm kiếm sản phẩm → Nhờ AI tư vấn chọn sản phẩm**, and send a request. The assistant is unavailable to signed-out users because the function verifies the user's Supabase session.
