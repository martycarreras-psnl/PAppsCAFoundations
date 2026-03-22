---
applyTo: "src/**"
---

# Power Apps Code Apps — Security & Authentication

This instruction file governs security practices for Code Apps. Security is non-negotiable — every pattern here applies to every Code App. Code reviews must flag violations.

## Authentication

Code Apps get Microsoft Entra ID (Azure AD) authentication for free. The Power Platform runtime handles the OAuth flow before your app code runs. Your app receives an authenticated user context — you never handle tokens, passwords, or login screens directly.

### Accessing the Current User

```typescript
// src/hooks/useCurrentUser.ts
import { useQuery } from '@tanstack/react-query';
import { Office365UsersService } from '@/generated/services/Office365UsersService';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => Office365UsersService.getMyProfile(),
    staleTime: 30 * 60 * 1000, // User profile rarely changes during a session
  });
}
```

### Role-Based UI Rendering

While data-level security is enforced by Dataverse/connector permissions (not your app), you may want to show/hide UI elements based on user roles:

```typescript
// src/hooks/useUserRoles.ts
export function useUserRoles() {
  const { data: user } = useCurrentUser();

  return useMemo(() => ({
    isAdmin: user?.jobTitle?.includes('Admin') ?? false,
    isManager: user?.jobTitle?.includes('Manager') ?? false,
    // Or fetch from a Dataverse security role table
  }), [user]);
}

// In a component:
function AdminPanel() {
  const { isAdmin } = useUserRoles();
  if (!isAdmin) return null;

  return <Card>Admin-only content</Card>;
}
```

Important: hiding UI elements is a UX convenience, not a security control. The actual data access is governed by the connector's permissions (Dataverse security roles, SQL permissions, etc.). A user who can't see the "Admin Panel" button still cannot access admin data if the connector permissions are configured correctly.

## Secrets Management

### The Cardinal Rule: No Secrets in Code

Never hardcode any of the following in source code, environment files committed to Git, or `power.config.json`:

- API keys or tokens
- Client secrets
- Connection strings
- Passwords
- Certificates or private keys
- Personal access tokens

### Where Secrets Belong

| Secret Type | Storage Location |
|-------------|-----------------|
| App Registration credentials (SPN) | 1Password shared vault (recommended) or `.env.local` (encrypted at rest); GitHub secrets for CI/CD (see `00-environment-setup.instructions.md`) |
| API keys for connectors | Power Platform connection configuration |
| Environment-specific config | Power Platform environment variables (created inside the solution) |
| Per-user auth | Microsoft Entra ID (handled by platform) |

### Local Secret Encryption

When the wizard writes `PP_CLIENT_SECRET` to `.env.local`, it encrypts the value using **AES-256-GCM** with a machine-specific key. The encrypted format uses an `ENC:` prefix:

```
PP_CLIENT_SECRET=ENC:iv_hex:authTag_hex:ciphertext_hex
```

**How it works:**
- **Algorithm**: AES-256-GCM (authenticated encryption — confidentiality + tamper detection)
- **Key derivation**: `scryptSync(hostname:username:salt, salt, 32)` — key is derived in-memory from the machine identity, never stored on disk
- **IV**: Random 16 bytes per encryption (never reused)
- **Portability**: Encrypted values only decrypt on the same machine + OS user. Moving `.env.local` to another machine will fail decryption — re-run the wizard or re-enter the secret.

**Implementation**: `wizard/lib/crypto.mjs` (encrypt/decrypt/isEncrypted)

The wizard's `secrets.mjs` recovery and `scripts/setup-auth.mjs` both auto-detect and decrypt `ENC:` values transparently. The legacy `setup-auth.sh` wrapper remains available for Bash-heavy environments.

### Pre-Commit Hook (papps-secret-guard)

A git pre-commit hook is installed automatically by the wizard (Step 4). It blocks commits that contain:
1. `.env.local` or `.env.*.local` files staged for commit
2. Plaintext `PP_CLIENT_SECRET=<value>` where the value is not `op://` or `ENC:` prefixed

The hook script lives at `scripts/pre-commit-hook.sh`. Manual installation:
```bash
cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

### .gitignore Must Include

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Power Platform auth
.pac/
auth.json

# IDE
.vscode/settings.json

# OS
.DS_Store
Thumbs.db

# Dependencies
node_modules/

# Build output
dist/

# Test output
coverage/
test-results/
playwright-report/
```

### Scanning for Leaked Secrets

The pre-commit hook (`papps-secret-guard`) catches secrets locally before they enter Git history. For CI/CD, add a pipeline step:

```yaml
# In CI pipeline
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@v3
  with:
    path: ./
    base: ${{ github.event.pull_request.base.sha }}
    head: ${{ github.event.pull_request.head.sha }}
```

## Input Validation & Sanitization

### Validate All User Inputs

Never trust form data. Validate on the client for UX, and rely on Dataverse/SQL constraints for enforcement:

```typescript
// src/utils/validation.ts
export function validateProjectName(name: string): string | null {
  if (!name.trim()) return 'Project name is required';
  if (name.length > 200) return 'Project name must be 200 characters or less';
  if (/<script/i.test(name)) return 'Invalid characters in project name';
  return null; // valid
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email.trim()) return 'Email is required';
  if (!emailRegex.test(email)) return 'Invalid email format';
  return null;
}
```

### Sanitize Dynamic Content

If you display user-generated content, sanitize it to prevent XSS:

```typescript
// React's JSX already escapes strings in {expressions}, so this is safe:
<Text>{project.description}</Text>

// DANGER — never use dangerouslySetInnerHTML with user data:
// <div dangerouslySetInnerHTML={{ __html: project.description }} />  // DO NOT DO THIS
```

If you genuinely need to render HTML (e.g., rich text from a connector), use a sanitization library:

```typescript
import DOMPurify from 'dompurify';

function RichText({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: [],
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

## Data Loss Prevention (DLP)

Power Platform administrators can set DLP policies that restrict which connectors can be used together. Your Code App must respect these policies. If your app uses connectors from different DLP groups, it will fail at runtime.

How to avoid issues:

1. Check your organization's DLP policies before choosing connectors
2. Keep business-critical connectors (Dataverse, SQL) separate from social connectors (Twitter, etc.)
3. Test in an environment with DLP policies enabled before deploying to production
4. If a connector call fails with a DLP error, surface a clear message to the user

```typescript
function isDlpError(error: any): boolean {
  return error?.code === 'DlpViolation' || error?.message?.includes('DLP');
}

// In error handling:
if (isDlpError(error)) {
  return (
    <MessageBar intent="error">
      <MessageBarBody>
        <MessageBarTitle>Policy Restriction</MessageBarTitle>
        This operation is restricted by your organization's data loss prevention policy.
        Contact your Power Platform administrator for assistance.
      </MessageBarBody>
    </MessageBar>
  );
}
```

## HTTPS Only

All Power Platform connections use HTTPS by default. If you're integrating with a Custom Connector pointing to your own API:

- The API endpoint must use HTTPS — HTTP endpoints are not allowed
- Ensure valid TLS certificates (self-signed certificates are not supported in production)
- Use TLS 1.2 or later

## Dependency Security

### Keep Dependencies Updated

```bash
# Check for known vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# For major version updates, review changelogs before updating
npx npm-check-updates
```

### Minimize Dependencies

Every npm package is an attack surface. Before adding a dependency, ask:

1. Can I write this myself in under 50 lines? If yes, do it.
2. Is this package actively maintained? Check last publish date and open issues.
3. How many downloads does it have? Low-download packages are higher risk.
4. Does it have known vulnerabilities? Check `npm audit`.

### Lock Dependencies

Always commit `package-lock.json`. Use `npm ci` (not `npm install`) in CI pipelines to ensure reproducible builds from the lockfile.

## Content Security

### Error Messages

Never expose technical details in user-facing error messages. Internal details help attackers:

```typescript
// Bad — exposes internals
<Text>Error: SQLSTATE[42S02] Base table 'dbo.projects_v2' not found</Text>

// Good — user-friendly, logs details separately
<Text>Unable to load projects. Please try again or contact support.</Text>
// Meanwhile, log the full error for debugging:
console.error('[ProjectService] Failed to fetch projects:', error);
```

### Logging

- Log enough to debug issues, but never log sensitive data (tokens, passwords, PII)
- Use structured logging with consistent fields
- In production, route logs to your organization's monitoring tool (Application Insights, etc.)
- Never log full request/response bodies from connectors — they may contain PII

## Dataverse Security Roles

Code Apps that use custom Dataverse tables must have a dedicated **supplementary** security role to grant users access to those tables. Dataverse denies access to custom entities by default — even for users who have the Basic User role.

### Supplementary Role Pattern

The correct approach is:

1. **Do NOT copy Basic User** — copying duplicates ~100+ platform privileges, creates drift risk when Microsoft updates Basic User, and makes the role hard to move across environments
2. **Create a supplementary role** that contains ONLY privileges for your custom tables
3. **Assign both roles** to each user: Basic User (platform access) + your custom role (app data access)
4. Dataverse security is **additive** — the union of all assigned roles determines what a user can do

### Naming Convention

```
<SOLUTION_DISPLAY_NAME> Collaborator
```

Examples: `Project Tracker Collaborator`, `Expense Manager Collaborator`

The name comes from `SOLUTION_DISPLAY_NAME` (captured by the setup wizard).

### Collaborator Privilege Levels

The "Collaborator" permission setting ([Microsoft docs](https://learn.microsoft.com/en-us/power-platform/admin/security-roles-privileges#permission-settings)) translates to:

| Privilege | Depth | What it means |
|-----------|-------|---------------|
| **Create** | Business Unit | Users can create records in their own BU |
| **Read** | Organization (Global) | Users can read ALL records across the org |
| **Write** | Business Unit | Users can update records in their own BU |
| **Delete** | Business Unit | Users can delete records in their own BU |
| **Append** | Business Unit | Users can attach records to this entity |
| **AppendTo** | Business Unit | Other records can reference this entity |
| **Assign** | Business Unit | Users can reassign records within their BU |
| **Share** | Business Unit | Users can share records within their BU |

This is the safe default for most business apps — broad read access so everyone can see data, but writes are scoped to the user's business unit.

### Why This Matters

- Without this role, any user who is not a System Administrator will get `403 Forbidden` on all CRUD operations against your custom tables
- The role must be **created inside your solution** (with `MSCRM.SolutionUniqueName` header) so it's included in solution export/import and travels through your ALM pipeline
- The script auto-detects all custom tables with your publisher prefix, so new tables automatically get covered when the script re-runs

### When to Assign Multiple Roles

| Scenario | Roles to assign |
|----------|-----------------|
| Standard app user | Basic User + `<App> Collaborator` |
| Power user who manages settings | Basic User + `<App> Collaborator` + custom admin role (if needed) |
| Service account / SPN | System Administrator (in dev/test) or minimum-privilege custom role (in prod) |
| CI/CD deployment identity | System Administrator (or System Customizer for schema-only changes) |

> **Programmatic creation**: See `07-dataverse-schema.instructions.md` → "Security Role — App Collaborator" section for full bash helpers to create the role and assign it to users via the Web API.

---

## Code Review Security Checklist

Every PR review should check:

- [ ] No secrets, API keys, or credentials in source code
- [ ] User inputs are validated before use
- [ ] Error messages don't expose technical internals
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] New dependencies are justified and vulnerability-free
- [ ] Connector queries use `$select` (don't fetch unnecessary columns that might contain sensitive data)
- [ ] Role-based UI checks don't replace actual data-level security
- [ ] `.gitignore` covers all sensitive file patterns
- [ ] `.env.local` secrets are encrypted (`ENC:` prefix) — never plaintext
- [ ] Pre-commit hook is installed (check `.git/hooks/pre-commit` exists)
- [ ] A `<SOLUTION_DISPLAY_NAME> Collaborator` security role exists and covers all custom tables
- [ ] The security role is supplementary (assigned alongside Basic User, not replacing it)
