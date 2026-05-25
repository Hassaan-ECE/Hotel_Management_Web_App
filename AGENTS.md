<!-- BEGIN:nextjs-agent-rules -->
# Hosted Hotel Management Web App

This is a separate hosted Next.js/Vercel application. Do not edit `D:\Projects\Active\Hotel_Management_App` from this project unless the user explicitly asks.

- Use Bun for frontend commands.
- Keep auth and authorization checks server-side and close to data access.
- Use Clerk for identity, but use the app database for hotel-level role membership.
- Use Neon Postgres and Drizzle schema/migrations for durable hosted data.
- Keep each hotel's operational data isolated by `hotel_id`.
- Do not initialize database or service clients at module scope; use lazy getters.
- Read relevant `node_modules/next/dist/docs` guidance before changing Next.js conventions.
<!-- END:nextjs-agent-rules -->