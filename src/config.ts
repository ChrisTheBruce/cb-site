// src/env.ts
export const getDebugMode = (env: { DEBUG_MODE?: string }) => {
  return env.DEBUG_MODE === 'true';
};
