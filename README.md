# Eleva UI - Plataforma RH Whitelabel

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Desenvolvimento local

### Autenticação (Supabase)

A aplicação usa Supabase Auth. Configure no `.env`:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

### Multi-tenant (Whitelabel)

A aplicação identifica o tenant pelo **subdomínio** ou pelo parâmetro `?tenant=` em desenvolvimento.

**Em localhost (sem subdomínio):**

- Acesse `http://localhost:8080` — usa o tenant padrão `demo`
- Use `http://localhost:8080?tenant=empresa` para simular o tenant `empresa`

**Com subdomínio em dev:**

1. Edite `/etc/hosts` e adicione:
   ```
   127.0.0.1 empresa.localhost
   127.0.0.1 demo.localhost
   ```

2. Acesse `http://empresa.localhost:8080` ou `http://demo.localhost:8080`

### Migrations Supabase

Execute as migrations na ordem (Supabase Dashboard > SQL Editor):

1. `supabase/migrations/001_create_profiles.sql` — tabela de perfis e trigger de signup
2. `supabase/migrations/002_tenants.sql` — tabela de tenants e multi-tenancy
3. `supabase/migrations/003_backfill_profiles.sql` — backfill de profiles (se necessário)
4. `supabase/migrations/004_organizational_structure.sql` — manager_id e RLS
5. `supabase/migrations/005_tenants_app_url.sql` — app_url para e-mails whitelabel

### Recuperação de senha (whitelabel)

O fluxo de recuperação usa o **Send Email Hook** do Supabase para enviar e-mails com a identidade visual do tenant.

**1. Configurar Resend**

- Crie uma conta em [Resend](https://resend.com)
- Verifique seu domínio
- Obtenha a API Key

**2. Deploy da Edge Function send-email**

```sh
# Definir secrets (antes do deploy)
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set SEND_EMAIL_HOOK_SECRET=<secret do Dashboard>
supabase secrets set RESEND_FROM_EMAIL=noreply@seudominio.com

# Deploy
supabase functions deploy send-email --no-verify-jwt
```

**3. Configurar Send Email Hook no Dashboard**

1. Acesse **Supabase Dashboard** > **Authentication** > **Hooks**
2. Crie um novo hook do tipo **Send Email**
3. Selecione **HTTPS** e informe a URL da função: `https://<projeto>.supabase.co/functions/v1/send-email`
4. Clique em **Generate Secret** e copie o valor
5. Configure o secret `SEND_EMAIL_HOOK_SECRET` na Edge Function (use o valor completo, ex: `v1,whsec_xxx`)
6. Salve o hook

**4. Configurar Redirect URLs**

Em **Authentication** > **URL Configuration** > **Redirect URLs**, adicione:

- `http://localhost:5173/redefinir-senha*`
- `http://localhost:8080/redefinir-senha*`
- URLs de produção para cada tenant (ex: `https://app.eleva.com/redefinir-senha*`)

**5. Habilitar notificação "Password changed"**

Em **Authentication** > **Email Templates** > **Security notifications**, habilite "Password changed" se desejar enviar e-mail de confirmação ao alterar a senha.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
