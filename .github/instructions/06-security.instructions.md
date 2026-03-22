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
| App Registration credentials (SPN) | 1Password shared vault (recommended) or `.env.local` for developers; GitHub secrets for CI/CD (see `00-environment-setup.instructions.md`) |
| API keys for connectors | Power Platform connection configuration |
| Environment-specific config | Power Platform environment variables (created inside the solution) |
| Per-user auth | Microsoft Entra ID (handled by platform) |

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

Add a pre-commit hook or CI step to detect accidentally committed secrets:

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
