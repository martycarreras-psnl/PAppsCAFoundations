// Step-specific guidance the user can paste back to their coding agent when
// a step fails or warns. The wizard can detect failures but most root causes
// (missing tools, broken PATH, tenant policy, RBAC, env vars, malformed
// inputs) need an agent to actually walk the user through a fix.
//
// Keep entries short. Each one names:
//  - what commonly goes wrong on this step
//  - a copy-pasteable prompt the user can hand their agent

export type AgentHelp = {
  /** Title shown in the MessageBar header. */
  title: string;
  /** Concise explanation of what usually fails on this step. */
  what: string;
  /** A single sentence the user can paste to their coding agent. */
  prompt: string;
};

const HELP: Record<number, AgentHelp> = {
  1: {
    title: 'Need help with a missing prerequisite?',
    what:
      'The wizard can detect missing tools (Node.js, .NET SDK, Python, PAC CLI, the Dataverse-skills plugin) but cannot install them for you.',
    prompt:
      'My PACAF prereq check failed — please walk me through installing what’s missing and fixing my PATH if needed.',
  },
  2: {
    title: 'Need help with project setup?',
    what:
      'Most failures here come from an invalid project name, a non-writable workspace folder, or a partially-initialised .env / power.config.json from a previous run.',
    prompt:
      'My PACAF wizard Step 2 (Project) failed — please look at my project folder, fix the .env / power.config.json, and tell me what to re-run.',
  },
  3: {
    title: 'Need help with authentication setup?',
    what:
      'This step picks an auth method (device code, browser, or App Registration). Failures usually mean tenant policy blocks the chosen method, the App Registration is missing API permissions / admin consent, or 1Password CLI isn’t signed in.',
    prompt:
      'My PACAF wizard Step 3 (Authentication) failed — please check my auth method choice and any App Registration / 1Password requirements, then tell me how to fix it.',
  },
  4: {
    title: 'Need help signing in?',
    what:
      'Sign-in failures usually mean PAC CLI isn’t on PATH, the device code wasn’t entered in time, the tenant blocks device-code flow, or a stale `pac auth` profile is interfering.',
    prompt:
      'My PACAF wizard Step 4 (Sign In) failed — please check my `pac auth list`, clear anything stale, and walk me through signing in again.',
  },
  5: {
    title: 'Need help picking an environment?',
    what:
      'If `pac env list` returns nothing or errors, you’re either signed in to the wrong tenant, the environments haven’t been provisioned, or your account lacks the System Administrator role on them.',
    prompt:
      'My PACAF wizard Step 5 (Environments) failed — please check my PAC tenant, list the environments I actually have access to, and tell me which one to use for Dev.',
  },
  6: {
    title: 'Need help with the publisher or solution?',
    what:
      'Failures here usually come from a prefix that’s already taken, a non-conforming prefix (must be 2–8 lowercase letters), or insufficient privileges to create a publisher/solution in the chosen environment.',
    prompt:
      'My PACAF wizard Step 6 (Solution & Publisher) failed — please check my publisher prefix against the rules in 00-environment-setup.instructions.md and tell me how to fix it.',
  },
  7: {
    title: 'Need help with the solution confirmation?',
    what:
      'This step normally auto-skips. If it errors, the solution from Step 6 didn’t persist correctly into .env / power.config.json, or the Dataverse bridge lost its cached secret.',
    prompt:
      'My PACAF wizard Step 7 (Solution Confirmed) failed — please inspect my .env / power.config.json and tell me what state I need to restore.',
  },
  8: {
    title: 'Need help with the scaffold?',
    what:
      '`pac code init` failures are usually caused by an expired `pac auth` profile mid-run, a corporate proxy / SSL inspection blocking npm, a OneDrive-synced workspace path, or insufficient privileges in the target environment.',
    prompt:
      'My PACAF wizard Step 8 (Scaffold) failed — please look at the log, check `pac auth list` and my workspace path, and tell me how to recover.',
  },
  9: {
    title: 'Need help binding connectors?',
    what:
      'Connector failures are almost always one of: the connection ID doesn’t exist in the chosen environment, you pasted a URL from the wrong tenant, or the connector’s API name (`shared_xxx`) was mistyped.',
    prompt:
      'My PACAF wizard Step 9 (Bind Connectors) failed — please check my connection IDs against the Power Apps maker portal and tell me which ones are wrong.',
  },
  10: {
    title: 'Need help with build or deploy?',
    what:
      '`npm run build` failures point at app code or TypeScript; `pac code push` failures usually mean the target solution doesn’t exist in that environment, the App Registration lacks privileges, or a connection reference isn’t mapped.',
    prompt:
      'My PACAF wizard Step 10 (Verify & Deploy) failed — please look at the log, decide whether it’s a build error or a push error, and tell me how to fix it.',
  },
  11: {
    title: 'Need help adding the app to your solution?',
    what:
      'This is a manual portal step. If you can’t find the app under your solution, the publisher prefix likely doesn’t match the solution’s prefix, or you’re looking in the wrong environment.',
    prompt:
      'My PACAF wizard Step 11 (Add App to Solution) is stuck — please confirm I’m in the right environment and solution, and walk me through adding the Code App.',
  },
};

export function getAgentHelp(stepNumber: number): AgentHelp | null {
  return HELP[stepNumber] ?? null;
}
