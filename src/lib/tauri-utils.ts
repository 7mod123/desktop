/**
 * Utility functions for Tauri integration
 */

// Cache the result to avoid repeated checks
let isTauriAvailableCache: boolean | null = null;

/**
 * Checks if the Tauri API is available in the current environment
 * @returns Promise<boolean> - True if Tauri is available, false otherwise
 */
export async function isTauri(): Promise<boolean> {
  // Return cached result if available
  if (isTauriAvailableCache !== null) {
    return isTauriAvailableCache;
  }

  try {
    // Try to import and use a simple Tauri API function
    const { getVersion } = await import("@tauri-apps/api/app");

    // Try to execute a Tauri function
    try {
      await getVersion();
      isTauriAvailableCache = true;
      return true;
    } catch (e) {
      // If this specific call fails but the import worked, Tauri might still be available
      // Let's try another approach
      const { invoke } = await import("@tauri-apps/api/core");

      try {
        // Try a simple invoke call that should be available
        await invoke("greet", { name: "test" });
        isTauriAvailableCache = true;
        return true;
      } catch (invokeError) {
        console.warn("Tauri invoke test failed:", invokeError);
        isTauriAvailableCache = false;
        return false;
      }
    }
  } catch (error) {
    // If we can't even import the API, Tauri is definitely not available
    console.warn("Tauri API import failed:", error);
    isTauriAvailableCache = false;
    return false;
  }
}

/**
 * Safe wrapper for Tauri's invoke function
 * @param command The command to invoke
 * @param args The arguments to pass to the command
 * @returns Promise with the result or null if Tauri is not available
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  if (!(await isTauri())) {
    console.warn(`Tauri not available, cannot invoke: ${command}`);
    return null;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Error invoking ${command}:`, error);
    throw error;
  }
}
