// Runs once when the server process starts (not at build time).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertStartupConfig } = await import("./lib/startup-check");
    assertStartupConfig();
  }
}
