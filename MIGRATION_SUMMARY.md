# Resumo da Migração: Supabase → Laravel Sanctum

## Status: ✅ Concluído

Migração completa da autenticação de Supabase para Laravel Sanctum com API REST.

---

## 📋 Tarefas Completadas

### 1. ✅ Cliente API (src/lib/api.ts)
- Criado cliente Axios configurado para Sanctum
- Implementado interceptor para CSRF token (XSRF-TOKEN)
- Implementado interceptor de resposta para tratamento de 401
- Configurado `withCredentials: true` para cookies

### 2. ✅ AuthContext Refatorado (src/contexts/AuthContext.tsx)
**Removido:**
- Import do Supabase
- Tipagem `User as SupabaseUser`
- Função `mapProfileToUser`
- Função `fetchProfile`
- Função `loadUser` com callback
- Listener `onAuthStateChange`

**Adicionado:**
- Import do cliente API
- Função `checkSession()` - verifica sessão ao carregar
- Login com CSRF cookie (`/sanctum/csrf-cookie` → `/api/login`)
- Logout simplificado (`/api/logout`)
- `finally` blocks garantindo `setIsLoading(false)`

### 3. ✅ Login Atualizado (src/pages/Login.tsx)
**Modificado:**
- Função `getAuthErrorMessage` para formato Laravel
- Tratamento de erros de validação (422)
- Tratamento de mensagens em `response.data.errors` e `response.data.message`
- Mensagens específicas para status codes (401, 429, 500)
- Tratamento de erros de rede

### 4. ✅ Variáveis de Ambiente
**Removido (.env):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Adicionado (.env):**
- `VITE_API_URL=http://localhost:8000`

**Atualizado (vite-env.d.ts):**
- Interface `ImportMetaEnv` agora contém apenas `VITE_API_URL`

### 5. ✅ Limpeza Supabase
- ❌ Removido `src/lib/supabase.ts`
- ❌ Desinstalado `@supabase/supabase-js` do package.json

### 6. ✅ Hooks de Dados (Preparados para Migração)
Todos os hooks foram preparados com stubs e TODOs para migração futura:

**useOnboarding.ts:**
- `fetchTemplateWithStepsAndTasks` → stub
- `useOnboarding` → queries desabilitadas
- `useTeamOnboarding` → query desabilitada
- `useAssignOnboarding` → mutation com erro
- `useOnboardingTemplates` → query desabilitada
- `useEmployeesForAssign` → query desabilitada

**useDisc.ts:**
- `useDiscQuestions` → query desabilitada
- `useDiscAssessment` → query desabilitada
- `useDiscAnswers` → query desabilitada
- `useDiscAssessmentsByProfile` → query desabilitada
- `useCreateDiscAssessment` → mutation com erro

**useCompetency.ts:**
- `useCompetencyCycles` → query desabilitada
- `useCompetencyItems` → query desabilitada
- `useMyCompetencyEvaluations` → query desabilitada
- `useCompetencyEvaluation` → query desabilitada
- `useCreateOrUpdateCompetencyEvaluation` → mutation com erro

**useIDP.ts:**
- `useIDPPlans` → query desabilitada
- `useIDPPlan` → query desabilitada
- `useCreateIDPPlan` → mutation com erro
- `useToggleIDPAction` → mutation com erro

---

## 🔧 Próximos Passos (Backend Laravel)

### 1. Instalar e Configurar Sanctum
```bash
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```

### 2. Configurar CORS (config/cors.php)
```php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
    'supports_credentials' => true,
];
```

### 3. Configurar Sanctum (config/sanctum.php)
```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:5173')),
```

### 4. Criar Rotas de Autenticação (routes/api.php)
```php
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/me', [AuthController::class, 'me'])->middleware('auth:sanctum');
```

### 5. Criar AuthController
```php
public function login(Request $request)
{
    $credentials = $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    if (!Auth::attempt($credentials)) {
        throw ValidationException::withMessages([
            'email' => ['Credenciais inválidas.'],
        ]);
    }

    $request->session()->regenerate();
    
    return response()->json([
        'user' => Auth::user()->load('profile'),
    ]);
}

public function me(Request $request)
{
    return response()->json($request->user()->load('profile'));
}

public function logout(Request $request)
{
    Auth::guard('web')->logout();
    $request->session()->invalidate();
    $request->session()->regenerateToken();
    
    return response()->json(['message' => 'Logged out']);
}
```

### 6. Configurar .env do Laravel
```env
FRONTEND_URL=http://localhost:5173
SESSION_DRIVER=cookie
SESSION_DOMAIN=localhost
SANCTUM_STATEFUL_DOMAINS=localhost:5173
```

---

## 🧪 Como Testar

1. **Iniciar Backend Laravel:**
   ```bash
   php artisan serve
   ```

2. **Iniciar Frontend React:**
   ```bash
   npm run dev
   ```

3. **Testar Fluxo:**
   - Acessar `/login`
   - Fazer login com credenciais válidas
   - Verificar redirecionamento para `/dashboard`
   - Recarregar página (deve manter sessão)
   - Fazer logout
   - Verificar redirecionamento para `/login`

---

## 📝 Notas Importantes

### Autenticação
- ✅ Sessão baseada em cookies (HttpOnly)
- ✅ CSRF protection automático
- ✅ Persistência de login ao recarregar
- ✅ Loading state correto (sem loops infinitos)
- ✅ Logout consistente

### Hooks de Dados
- ⚠️ Todos os hooks de dados (Onboarding, DISC, Competency, IDP) estão **desabilitados**
- ⚠️ Queries retornam arrays/objetos vazios
- ⚠️ Mutations lançam erros informativos
- ⚠️ TODOs marcados para migração futura
- ⚠️ Interfaces mantidas para compatibilidade

### Segurança
- 🔒 Sem tokens no localStorage
- 🔒 Cookies HttpOnly gerenciados pelo Laravel
- 🔒 CSRF token em todas as requisições
- 🔒 Session regeneration após login

---

## 🎯 Benefícios da Migração

1. **Centralização:** Autenticação e sessão controladas pelo backend
2. **Segurança:** Cookies HttpOnly + CSRF protection
3. **Simplicidade:** Sem listeners ou lógica complexa no frontend
4. **Estabilidade:** Loading states corretos, sem loops infinitos
5. **Escalabilidade:** Preparado para crescimento do MVP

---

## 📚 Referências

- [Laravel Sanctum Docs](https://laravel.com/docs/sanctum)
- [SPA Authentication](https://laravel.com/docs/sanctum#spa-authentication)
- [Axios Interceptors](https://axios-http.com/docs/interceptors)
