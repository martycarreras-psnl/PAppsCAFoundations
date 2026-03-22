---
applyTo: "src/generated/**,src/hooks/**,src/services/**"
---

# Power Apps Code Apps — Connectors & Data Integration

This instruction file governs how developers add, configure, and work with Power Platform connectors in Code Apps. Connectors are the primary way Code Apps access data — treat them as a first-class architectural concern, not an afterthought.

## Supported Connectors

These connectors have official support and documented patterns for Code Apps:

| Connector | Common Use Cases |
|-----------|-----------------|
| **Dataverse** | Full CRUD, complex queries, relationships, business logic |
| **SQL Server / Azure SQL** | Relational data, reporting queries, legacy system integration |
| **SharePoint** | Document libraries, lists, metadata |
| **Office 365 Users** | User profiles, org charts, people search |
| **Office 365 Groups** | Team membership, group management |
| **Azure Data Explorer** | Large-scale analytics, time-series data |
| **OneDrive for Business** | File storage, document management |
| **Microsoft Teams** | Messaging, channel operations |
| **Custom Connectors** | Any REST API via OpenAPI spec |

## Adding a Data Source

**Solution reminder:** Every connector you add creates a **connection reference** in your Power Platform solution. Make sure your Code App's solution is active before running these commands. If you're also creating Dataverse tables for the connector to use, create those tables from within the solution context. See `01-scaffold.instructions.md` for the full solution-first rules.

### Via PAC CLI (preferred)

```bash
# Interactive — lists available connectors and lets you pick
pac code add-data-source

# After adding, generate typed TypeScript services
pac code generate
```

This creates files in `src/generated/`:
- `services/<ConnectorName>Service.ts` — Methods for each operation the connector exposes
- `models/<EntityName>.ts` — TypeScript interfaces for request/response shapes

### What Happens Under the Hood

When you run `pac code add-data-source`, the CLI:
1. Registers the connector in `power.config.json`
2. Scaffolds connection reference metadata
3. Prepares the connector for consent flow at runtime

When you run `pac code generate`, the CLI:
1. Reads the connector's OpenAPI definition
2. Generates strongly-typed TypeScript service classes and model interfaces
3. Places everything under `src/generated/`

## Working with Generated Code

### The Golden Rule: Never Edit Generated Files

Generated files will be overwritten on the next `pac code generate`. Instead:

**Wrap services with custom hooks:**

```typescript
// src/hooks/useProjects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SqlService } from '@/generated/services/SqlService';
import type { Project } from '@/generated/models/Project';

// Query key factory — centralizes cache key management
const projectKeys = {
  all: ['projects'] as const,
  byId: (id: string) => ['projects', id] as const,
  byStatus: (status: string) => ['projects', 'status', status] as const,
};

export function useProjects(status?: string) {
  return useQuery({
    queryKey: status ? projectKeys.byStatus(status) : projectKeys.all,
    queryFn: () => SqlService.getProjects({ $filter: status ? `status eq '${status}'` : undefined }),
    staleTime: 5 * 60 * 1000, // 5 minutes — connectors are not free; avoid unnecessary calls
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.byId(id),
    queryFn: () => SqlService.getProject(id),
    enabled: !!id, // Don't fetch until we have an ID
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newProject: Omit<Project, 'id'>) =>
      SqlService.createProject(newProject),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}
```

**Extend models with computed properties:**

```typescript
// src/types/ProjectExtended.ts
import type { Project } from '@/generated/models/Project';

export interface ProjectWithComputed extends Project {
  isOverdue: boolean;
  daysRemaining: number;
}

export function enrichProject(project: Project): ProjectWithComputed {
  const dueDate = new Date(project.dueDate);
  const now = new Date();
  return {
    ...project,
    isOverdue: dueDate < now,
    daysRemaining: Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  };
}
```

## Connector-Specific Patterns

### Dataverse

Dataverse is the richest connector. Use OData query parameters for efficient data retrieval:

```typescript
// Expand related records (avoid N+1 queries)
const projects = await DataverseService.getProjects({
  $select: 'name,status,duedate',
  $expand: 'ownerid($select=fullname,emailaddress)',
  $filter: "statecode eq 0",
  $orderby: 'duedate asc',
  $top: 50,
});
```

**Relationship patterns:**

For many-to-many relationships, work through the junction/intersect entity:

```typescript
// Fetch project team members (many-to-many via project_team_member intersect)
const teamMembers = await DataverseService.getProjectTeamMembers({
  $filter: `projectid eq '${projectId}'`,
  $expand: 'userid($select=fullname,emailaddress)',
});
```

For polymorphic lookups (e.g., a `customerid` that could reference either Account or Contact):

```typescript
function resolveCustomer(record: any) {
  const type = record['customerid@odata.type'];
  if (type?.includes('account')) {
    return { type: 'account' as const, id: record.customerid, name: record['customerid@OData.Community.Display.V1.FormattedValue'] };
  }
  return { type: 'contact' as const, id: record.customerid, name: record['customerid@OData.Community.Display.V1.FormattedValue'] };
}
```

### SQL Server / Azure SQL

SQL connectors support parameterized queries and stored procedures. Always use pagination for large result sets:

```typescript
// src/hooks/useEmployees.ts
export function useEmployees(page: number, pageSize: number = 25) {
  return useQuery({
    queryKey: ['employees', page, pageSize],
    queryFn: () => SqlService.getEmployees({
      $top: pageSize,
      $skip: page * pageSize,
      $orderby: 'lastName asc',
    }),
    placeholderData: keepPreviousData, // TanStack Query — show stale data while fetching next page
  });
}
```

### Office 365 Users

User data is read-only. Cache aggressively since org data changes infrequently:

```typescript
export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => Office365UsersService.getMyProfile(),
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000,    // 1 hour
  });
}

export function useUserPhoto(userId: string) {
  return useQuery({
    queryKey: ['userPhoto', userId],
    queryFn: () => Office365UsersService.getUserPhoto(userId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours — photos rarely change
    enabled: !!userId,
  });
}
```

### Custom Connectors (REST APIs)

For custom APIs, start by defining your OpenAPI spec and registering it as a custom connector in Power Platform. Then add it to your Code App:

```bash
pac code add-data-source  # Select your custom connector from the list
pac code generate          # Generates typed services from the OpenAPI spec
```

The generated service will have methods matching your API's operations. Wrap them with hooks just like built-in connectors.

## Connector Consent Flow

When a user first accesses a connector in a deployed Code App, Power Platform presents a consent dialog asking them to authorize the connection. Your app must handle this gracefully:

```typescript
// src/hooks/useConnectorStatus.ts
import { useQuery } from '@tanstack/react-query';

export function useConnectorStatus(connectorName: string) {
  return useQuery({
    queryKey: ['connectorStatus', connectorName],
    queryFn: async () => {
      try {
        // Attempt a lightweight operation to check connectivity
        await connectorService.ping();
        return { connected: true, error: null };
      } catch (error: any) {
        if (error.code === 'CONSENT_REQUIRED') {
          return { connected: false, error: 'consent_required' };
        }
        return { connected: false, error: error.message };
      }
    },
    retry: false,
  });
}
```

## Error Handling for Connectors

Connector calls can fail for many reasons — network issues, throttling, consent expiry, DLP policy blocks. Always handle errors at the hook level:

```typescript
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => SqlService.getProjects(),
    retry: (failureCount, error: any) => {
      // Don't retry auth/consent errors — they need user action
      if (error.code === 'CONSENT_REQUIRED' || error.status === 401) return false;
      // Retry transient errors up to 3 times
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
```

In components, use error boundaries and TanStack Query's error states:

```tsx
function ProjectList() {
  const { data, isLoading, error } = useProjects();

  if (isLoading) return <Spinner label="Loading projects..." />;
  if (error) return <ConnectorError error={error} connectorName="SQL Server" />;
  if (!data?.length) return <EmptyState message="No projects found" />;

  return (
    <div>
      {data.map(project => <ProjectCard key={project.id} project={project} />)}
    </div>
  );
}
```

## Performance Guidelines for Connectors

Connector calls cost time and API quota. Minimize them:

1. **Select only needed columns** — Always use `$select` to avoid fetching entire records
2. **Server-side filtering** — Use `$filter` instead of fetching all records and filtering in JS
3. **Pagination** — Use `$top` and `$skip` for large datasets; never fetch unbounded result sets
4. **Expand judiciously** — `$expand` is powerful but each expansion is an additional join/query
5. **Cache aggressively** — Set appropriate `staleTime` in TanStack Query based on how often the data changes
6. **Deduplicate** — TanStack Query automatically deduplicates concurrent requests for the same query key
7. **Prefetch** — Use `queryClient.prefetchQuery()` for data you know the user will need next

```typescript
// Prefetch the next page while user is viewing current page
const queryClient = useQueryClient();
useEffect(() => {
  if (hasNextPage) {
    queryClient.prefetchQuery({
      queryKey: ['projects', currentPage + 1],
      queryFn: () => SqlService.getProjects({ $top: 25, $skip: (currentPage + 1) * 25 }),
    });
  }
}, [currentPage, hasNextPage]);
```
