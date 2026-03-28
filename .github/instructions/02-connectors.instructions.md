---
applyTo: "src/generated/**,src/hooks/**,src/services/**"
---

# Power Apps Code Apps — Connectors & Data Integration

This instruction file governs how developers add, configure, and work with Power Platform connectors in Code Apps. Connectors are the primary way Code Apps access data — treat them as a first-class architectural concern, not an afterthought.

Connector registration is downstream of planning. If the user is still describing the business problem, still deciding core workflows, or still refining the conceptual data model, stop and complete the planning flow first:

- `00a-business-problem-decomposition.instructions.md`
- `00b-scope-refinement-and-solution-shaping.instructions.md`
- `00c-solution-concept-to-dataverse-plan.instructions.md`

If Dataverse tables are part of the solution, follow `07-dataverse-schema.instructions.md` before registering those tables as data sources.

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

**Planning reminder:** Do not use `pac code add-data-source` as a discovery tool for figuring out what your app should connect to. The connector strategy should follow a refined business scope and, for Dataverse, an approved schema plan.

### Recommended Timing

Do not ask for connection IDs during the initial scaffold if the app is still in the planning or prototype phase. The recommended order is:

1. Plan the workflow and conceptual model
2. Prototype the UX with mock providers
3. Refine the planning payload based on prototype feedback
4. Bind real connectors and data sources only when the model is stable

### Via PAC CLI (preferred)

```bash
# Dataverse tables
pac code add-data-source -a dataverse -t <logical_table_name>

# Non-Dataverse connectors
pac code add-data-source -a <connector_api_id> -c <connection_id>
```

When a developer is ready to bind a non-Dataverse connector, first try to discover existing connections in the environment:

```bash
pac connection list
```

Filter the output to the connector API ID such as `shared_office365users` or `shared_sharepointonline`, then present the discovered connections and let the developer choose one. If no matching connection exists, instruct the developer to create it in Power Apps Maker Portal → Data → Connections, then re-scan. Only fall back to pasted Connection IDs when discovery is not possible.

This creates files in `src/generated/`:
- `services/<ConnectorName>Service.ts` — Methods for each operation the connector exposes
- `models/<EntityName>.ts` — TypeScript interfaces for request/response shapes

### What Happens Under the Hood

When you run `pac code add-data-source`, the CLI:
1. Registers the connector in `power.config.json`
2. Scaffolds connection reference metadata
3. Prepares the connector for consent flow at runtime

As part of `pac code add-data-source`, the CLI:
1. Reads the connector's OpenAPI definition
2. Generates strongly-typed TypeScript service classes and model interfaces
3. Places everything under `src/generated/`

## Working with Generated Code

Before connector registration, prototype UX should depend on domain contracts and a mock provider. After connector registration, generated services should be adapted into those same contracts rather than becoming the contract themselves.

### Provider Boundary First

Use this layering:

1. `src/types/**` for domain models used by the UI
2. `src/services/data-contracts.ts` for repository or provider interfaces
3. `src/services/mock-*.ts` for prototype mode implementations
4. `src/generated/**` plus adapter files for real implementations

This keeps the mock-to-real swap localized and prevents generated connector shapes from leaking through the app.

### The Golden Rule: Never Edit Generated Files

Generated files will be overwritten the next time connector output is refreshed by `pac code add-data-source`. Instead:

**Adapt services behind repository contracts:**

```typescript
// src/services/real-project-repository.ts
import { SqlService } from '@/generated/services/SqlService';
import type { Project } from '@/types/domain-models';
import type { ProjectRepository } from '@/services/data-contracts';

export function createRealProjectRepository(): ProjectRepository {
  return {
    async list() {
      const result = await SqlService.getProjects();
      return (result.data || []).map(mapProjectFromConnector);
    },
    async getById(id: string) {
      const result = await SqlService.getProject(id);
      return result.data ? mapProjectFromConnector(result.data) : null;
    },
    async save(input) {
      const result = input.id
        ? await SqlService.updateProject(input.id, mapProjectToConnector(input))
        : await SqlService.createProject(mapProjectToConnector(input));
      if (result.error) throw result.error;
      return mapProjectFromConnector(result.data);
    },
  };
}
```

Then let hooks consume the contract:

```typescript
// src/hooks/useProjects.ts
import { useQuery } from '@tanstack/react-query';
import { createAppDataProvider } from '@/services/providerFactory';

const provider = createAppDataProvider();

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => provider.projects.list(),
  });
}
```

Generated connector types are useful inputs to the adapter layer. They should not dictate the shape of the app-facing model during prototype-first development.

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
