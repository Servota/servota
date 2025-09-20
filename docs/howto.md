# How-To Guide — Servota

Quick reference commands for common tasks in the project.

---

## Run Mobile (Expo) Server

bash: cd apps/mobile pnpm start

## Run Web (PWA) Server

bash: cd apps/web pnpm dev

## Export Database Schema (Hosted Supabase)

bash: pg_dump "postgresql://postgres.kavfmzuntpuamgfossqp:<YOUR_DB_PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres" --schema-only --no-owner > scheme-from-migration.sql  
bash: dir scheme-from-migration.sql  
bash: git add scheme-from-migration.sql  
bash: git commit -m "chore(db): export current hosted schema snapshot"  
bash: git push origin main

## Run Supabase Local

bash: npx supabase start

## Link Supabase Project (one-time)

bash: npx supabase link --project-ref kavfmzuntpuamgfossqp

## Common Git Workflows

bash: git checkout -b feature/my-change  
bash: git add .  
bash: git commit -m "feat: describe my change"  
bash: git push origin feature/my-change  
bash: git checkout main  
bash: git pull origin main  
bash: git checkout feature/my-change  
bash: git merge main
