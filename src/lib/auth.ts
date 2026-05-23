export interface Manager {
  id: string;
  name: string;
  email: string;
}

/**
 * Mock auth — returns a hard-coded demo manager.
 * Replace with real session lookup when auth is implemented.
 */
export function getCurrentManager(): Manager {
  return {
    id: "demo_manager",
    name: "Demo Manager",
    email: "demo@rentpilot.ai",
  };
}
