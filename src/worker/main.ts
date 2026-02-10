/**
 * Any function exported from this file becomes
 * available on the Comlink proxy in your React app.
 */
export const getGreeting = (name: string): string => {
  // Simulate a heavy-ish string operation or just a simple return
  return `Hello, ${name}! I'm speaking to you from a background thread.`;
};
