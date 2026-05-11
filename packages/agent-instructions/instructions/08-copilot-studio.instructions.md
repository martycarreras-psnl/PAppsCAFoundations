---
applyTo: "src/**,src/hooks/**,src/components/**,src/services/**"
---

# Power Apps Code Apps — Copilot Studio Agent Integration

This instruction file governs how Code Apps connect to and interact with Microsoft Copilot Studio custom agents. When a user asks to add a conversational AI agent, chatbot, or Copilot Studio integration to their Code App, follow this file exactly.

## Phase Contract — Human-in-the-Loop Discovery First

Copilot Studio integration has mandatory discovery steps that cannot be guessed.

**Inputs required before code changes:**
- A published Copilot Studio agent
- A valid Copilot Studio connector connection in the target environment
- The exact `agentName`

**Mandatory outputs:**
- Resolved `connectionId`
- Confirmed `agentName`
- Generated `CopilotStudioService`
- Working invocation code that uses `ExecuteCopilotAsyncV2`

**Stop conditions:**
- If the agent is unpublished, stop
- If the connector connection does not exist, stop and prompt the user to create it
- If the agent name has not been provided by the user, stop and ask for it

## Human Intervention Protocol

Some Copilot Studio steps require direct user action. Whenever the workflow reaches one of these steps, clearly tell the user:

1. What they must do
2. Where they must do it
3. Which value to bring back

Do not guess, assume, or skip human-intervention steps.

## When This Applies

Use this guidance when the user wants to:
- Add a conversational agent or chatbot to their Code App
- Connect to a Microsoft Copilot Studio agent
- Invoke a Copilot Studio agent from React code
- Build a chat UI that talks to a Copilot Studio agent
- Parse or display agent responses in the app

## Prerequisites

Before writing any integration code, these must be true:

1. **The Code App is initialized** — `power.config.json` exists, `pac code init` has been run
2. **A Copilot Studio agent exists and is published** — the user must have created and published an agent in [Copilot Studio](https://copilotstudio.microsoft.com/)
3. **The user knows the agent name** — found in Copilot Studio → Channels → Web app → connection string URL. Format: `cr3e1_customerSupportAgent` (publisher prefix + agent name, case-sensitive)
4. **PAC auth is working** — `pac org who` shows the correct environment

If any prerequisite is missing, guide the user to complete it before writing code.

## Step 1: Ensure a Copilot Studio Connection Exists

The Copilot Studio connector requires a connection in the target environment, just like any other connector.

### Preferred discovery flow

Use the scripted discovery helper first:

```bash
node scripts/discover-copilot-connection.mjs
```

Prefer the `.mjs` entry point for cross-platform execution on macOS, Linux, and Windows. The `.sh` variant remains available for Bash-heavy environments.

Behavior:
- **0 connections found** — prints Maker Portal steps, waits, retries
- **1 connection found** — selects automatically
- **2+ connections found** — prompts the user to choose one

The final stdout line is machine-readable:

```text
COPILOT_CONNECTION_ID=<connectionId>
```

If the script exits non-zero, stop and surface the error before proceeding.

### Check for an existing connection

```bash
pac connection list
```

Look for a connection with API ID: `/providers/Microsoft.PowerApps/apis/shared_microsoftcopilotstudio`

If found, copy the `connectionId` value.

### Create a new connection (if none exists)

Connections for Copilot Studio must be created in the Power Apps Maker Portal — there is no CLI command to create one.

1. Open [make.powerapps.com](https://make.powerapps.com) → select the target environment
2. Navigate to **Connections** → **+ New connection**
3. Search for **Microsoft Copilot Studio**
4. Authenticate and create the connection
5. Copy the **Connection ID** from the browser URL:
   ```
   https://make.powerapps.com/environments/xxx/connections/shared_microsoftcopilotstudio/<CONNECTION_ID>/details
   ```

Record this Connection ID — you need it for the next step.

## Step 2: Add the Copilot Studio Connector to the Code App

```bash
pac code add-data-source -a "shared_microsoftcopilotstudio" -c <connectionId>
```

Replace `<connectionId>` with the actual Connection ID from Step 1.

This automatically:
- Updates `power.config.json` with the Copilot Studio data source
- Generates TypeScript service and model files in `src/generated/`

After adding the data source, verify the generated files exist:
- `src/generated/services/CopilotStudioService.ts`
- Associated model files in `src/generated/models/`

**Do not edit generated files.** If you need to extend types, create wrappers in `src/types/`.

### Discovery Part 2 — Collect the agent name from the user

After connection discovery, ask the user for the exact agent name from Copilot Studio:

1. Open [copilotstudio.microsoft.com](https://copilotstudio.microsoft.com)
2. Open the published agent
3. Go to **Channels → Web app**
4. Copy the `{AGENT_NAME}` segment from the connection URL

The name is case-sensitive and usually includes the publisher prefix.

## Step 3: Invoke the Agent

### The Correct API Method

**Always use `ExecuteCopilotAsyncV2`.** This is the only method that returns the agent's response synchronously. Other methods have known issues:

| Method | API Path | Status |
|--------|----------|--------|
| **`ExecuteCopilotAsyncV2`** | `/proactivecopilot/executeAsyncV2` | **Use this one** — returns responses synchronously |
| `ExecuteCopilot` | `/execute` | Do NOT use — fire-and-forget, only returns `conversationId` |
| `ExecuteCopilotAsync` | `/executeAsync` | Do NOT use — returns 502 errors |

### Basic Invocation

```typescript
import { CopilotStudioService } from '@/generated/services/CopilotStudioService';

const response = await CopilotStudioService.ExecuteCopilotAsyncV2({
  message: "What is the status of my order?",
  notificationUrl: "https://notificationurlplaceholder",
  agentName: "cr3e1_customerSupportAgent",
});
```

### Request Parameters

| Parameter | Required | Type | Description |
|-----------|----------|------|-------------|
| `message` | Yes | `string` | The user's message or prompt. Can be a JSON string for structured data. |
| `notificationUrl` | Yes | `string` | Always use `"https://notificationurlplaceholder"`. Required by the API but unused in synchronous mode. |
| `agentName` | Yes | `string` | The published agent's name. Case-sensitive. Includes the publisher prefix (e.g. `cr3e1_agentName`). |

### Response Structure

| Property | Type | Description |
|----------|------|-------------|
| `responses` | `string[]` | Array of response strings from the agent |
| `conversationId` | `string` | Conversation ID for multi-turn tracking |
| `lastResponse` | `string` | The most recent response from the agent |
| `completed` | `boolean` | Whether the agent finished processing |

### Handling Response Property Casing

The Copilot Studio API has a known issue where response property casing can vary. Always use a safe accessor pattern:

```typescript
// Response casing can vary — always handle all variations
function getConversationId(data: Record<string, unknown>): string | undefined {
  return (data.conversationId ?? data.ConversationId ?? data.conversationID) as string | undefined;
}
```

## Step 4: Build a Chat Hook

Wrap the Copilot Studio service in a custom hook using TanStack Query's `useMutation`:

```typescript
// src/hooks/useCopilotAgent.ts
import { useMutation } from '@tanstack/react-query';
import { CopilotStudioService } from '@/generated/services/CopilotStudioService';
import { useState, useCallback } from 'react';

export interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

interface SendMessageParams {
  message: string;
  agentName: string;
  conversationId?: string;
}

const NOTIFICATION_URL_PLACEHOLDER = "https://notificationurlplaceholder";

export function useCopilotAgent(agentName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();

  const mutation = useMutation({
    mutationFn: async ({ message }: SendMessageParams) => {
      const response = await CopilotStudioService.ExecuteCopilotAsyncV2({
        message,
        notificationUrl: NOTIFICATION_URL_PLACEHOLDER,
        agentName,
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Handle casing variations
      const convId = (data.conversationId ?? data.ConversationId ?? data.conversationID) as string | undefined;
      if (convId) setConversationId(convId);

      const agentReply = data.lastResponse ?? data.responses?.[data.responses.length - 1];
      if (agentReply) {
        setMessages(prev => [...prev, {
          role: 'agent',
          content: agentReply,
          timestamp: new Date(),
        }]);
      }
    },
  });

  const sendMessage = useCallback((message: string) => {
    // Add user message to history immediately
    setMessages(prev => [...prev, {
      role: 'user',
      content: message,
      timestamp: new Date(),
    }]);

    mutation.mutate({ message, agentName, conversationId });
  }, [mutation, agentName, conversationId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    isLoading: mutation.isPending,
    error: mutation.error,
    conversationId,
  };
}
```

## Step 5: Build a Chat UI Component

Use Fluent UI v9 components for the chat interface:

```typescript
// src/components/CopilotChat/CopilotChat.tsx
import { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardHeader,
  Button,
  Input,
  Text,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { SendRegular, DismissRegular } from '@fluentui/react-icons';
import { useCopilotAgent, type ChatMessage } from '@/hooks/useCopilotAgent';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '500px',
    maxWidth: '480px',
  },
  messageArea: {
    flex: 1,
    overflowY: 'auto',
    padding: tokens.spacingVerticalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    maxWidth: '80%',
  },
  agentMessage: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    maxWidth: '80%',
  },
  inputRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});

interface CopilotChatProps {
  agentName: string;
  title?: string;
}

export function CopilotChat({ agentName, title = 'Chat with Agent' }: CopilotChatProps) {
  const styles = useStyles();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, clearChat, isLoading } = useCopilotAgent(agentName);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className={styles.container}>
      <CardHeader
        header={<Text weight="semibold">{title}</Text>}
        action={<Button appearance="subtle" icon={<DismissRegular />} onClick={clearChat} title="Clear chat" />}
      />
      <div className={styles.messageArea} role="log" aria-label="Chat messages">
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? styles.userMessage : styles.agentMessage}>
            <Text>{msg.content}</Text>
          </div>
        ))}
        {isLoading && <Spinner size="tiny" label="Agent is thinking..." />}
        <div ref={bottomRef} />
      </div>
      <div className={styles.inputRow}>
        <Input
          placeholder="Type a message..."
          value={input}
          onChange={(_, data) => setInput(data.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          style={{ flex: 1 }}
        />
        <Button
          appearance="primary"
          icon={<SendRegular />}
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
        />
      </div>
    </Card>
  );
}
```

### Usage in a Page

```typescript
// src/pages/Support/Support.tsx
import { CopilotChat } from '@/components/CopilotChat/CopilotChat';

export function SupportPage() {
  return (
    <div>
      <h1>Customer Support</h1>
      <CopilotChat
        agentName="cr3e1_customerSupportAgent"
        title="Support Assistant"
      />
    </div>
  );
}
```

## Mock Data for Prototype Mode

When developing with `npm run dev:local` (mock mode), the Copilot Studio service is unavailable. Create a mock that simulates agent responses:

```typescript
// src/mockData/copilotAgent.ts

const MOCK_RESPONSES: Record<string, string> = {
  default: "I'm a mock agent. In connected mode, I'll be powered by Copilot Studio.",
  hello: "Hello! How can I help you today?",
  help: "I can help with order status, product information, and general support questions.",
};

export async function mockAgentResponse(message: string): Promise<{
  responses: string[];
  conversationId: string;
  lastResponse: string;
  completed: boolean;
}> {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));

  const lowerMessage = message.toLowerCase();
  let reply = MOCK_RESPONSES.default;
  for (const [keyword, response] of Object.entries(MOCK_RESPONSES)) {
    if (lowerMessage.includes(keyword)) {
      reply = response;
      break;
    }
  }

  return {
    responses: [reply],
    conversationId: 'mock-conversation-' + Date.now(),
    lastResponse: reply,
    completed: true,
  };
}
```

Update the hook to use mocks in prototype mode:

```typescript
// In useCopilotAgent.ts — add mock support
import { mockAgentResponse } from '@/mockData/copilotAgent';

const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_MOCK === 'true';

// Inside useMutation's mutationFn:
mutationFn: async ({ message }: SendMessageParams) => {
  if (USE_MOCK) {
    return mockAgentResponse(message);
  }
  const response = await CopilotStudioService.ExecuteCopilotAsyncV2({
    message,
    notificationUrl: NOTIFICATION_URL_PLACEHOLDER,
    agentName,
  });
  return response.data;
},
```

## Parsing Structured Responses

Copilot Studio agents often return JSON in their responses. When working with structured data, parse safely:

```typescript
// src/utils/parseAgentResponse.ts

export interface ParsedAgentData {
  text?: string;
  data?: Record<string, unknown>;
  parseError?: boolean;
}

export function parseAgentResponse(raw: string): ParsedAgentData {
  try {
    const parsed = JSON.parse(raw);
    return { data: parsed };
  } catch {
    // Not JSON — treat as plain text (this is normal and expected)
    return { text: raw };
  }
}
```

Usage:

```typescript
import { parseAgentResponse } from '@/utils/parseAgentResponse';

const result = parseAgentResponse(response.data.lastResponse);
if (result.data) {
  // Structured response — extract fields
  const summary = result.data.summary as string;
  const metrics = result.data.metrics as number[];
} else {
  // Plain text response — display directly
  displayMessage(result.text ?? '');
}
```

## Sending Structured Input

When your agent expects structured data, serialize it as a JSON string in the `message` parameter:

```typescript
const response = await CopilotStudioService.ExecuteCopilotAsyncV2({
  message: JSON.stringify({
    query: "monthly sales",
    filters: { region: "West", year: 2026 },
  }),
  notificationUrl: "https://notificationurlplaceholder",
  agentName: "cr3e1_dataAnalyzer",
});
```

The agent's topics and knowledge must be configured to handle this input format in Copilot Studio.

## Troubleshooting

### Agent returns no response

1. Verify the agent is **published** in Copilot Studio
2. Confirm the `agentName` matches exactly (case-sensitive, includes publisher prefix)
3. Confirm you are using `ExecuteCopilotAsyncV2` — not `ExecuteCopilot` or `ExecuteCopilotAsync`
4. Check that the agent has topics configured to handle your input

### 502 or server errors

- You are likely using the wrong method. Switch to `ExecuteCopilotAsyncV2`
- Verify the Copilot Studio connection is healthy: `pac connection list`

### Connection not found

- Create the connection in the Power Apps Maker Portal (see Step 1)
- Re-run `pac code add-data-source -a "shared_microsoftcopilotstudio" -c <connectionId>`

### Generated service missing `ExecuteCopilotAsyncV2`

- Re-run `pac code add-data-source -a "shared_microsoftcopilotstudio" -c <connectionId>` to refresh the generated service
- If still missing, check your PAC CLI version — update if needed: `dotnet tool update -g Microsoft.PowerApps.CLI.Tool`

### Property casing inconsistencies

Response properties may use different casing (`conversationId` vs `ConversationId`). Always use the safe accessor pattern shown in Step 3.

## Security Considerations

- **Never hardcode the agent name** if it contains sensitive identifiers. Use an environment variable or app constant.
- **Validate agent responses before rendering.** Use React's default JSX escaping — never use `dangerouslySetInnerHTML` with agent output.
- **Rate-limit user input.** Copilot Studio calls have throttling limits. Debounce the send button or add a cooldown.
- **Sanitize structured input.** If you serialize user input to JSON for the agent, validate it first — don't pass raw user strings into JSON.stringify without checking for injection patterns.

## Output Contract

When this phase is complete, return:

1. **Actions** — connection discovery, data-source registration, invocation wiring
2. **Artifacts** — `power.config.json`, generated Copilot service file, hook/component code
3. **Validation** — build result and confirmation that `ExecuteCopilotAsyncV2` is used
4. **Next phase** — test the Copilot flow before deployment

## Reference

- [Connect Code App to Copilot Studio](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/connect-to-copilot-studio)
- [Microsoft Copilot Studio connector](https://learn.microsoft.com/en-us/connectors/microsoftcopilotstudio/)
- [Copilot Studio documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/)
- Connector API ID: `/providers/Microsoft.PowerApps/apis/shared_microsoftcopilotstudio`
- Internal name: `shared_microsoftcopilotstudio`
