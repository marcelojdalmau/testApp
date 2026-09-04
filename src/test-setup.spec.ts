/**
 * Global test setup.
 *
 * The mock stores (`MockItemService`, `MockTaskService`) now persist their
 * state to localStorage so data survives a page reload (F5). In the test
 * environment that persistence would otherwise leak between specs, since a
 * fresh service instance hydrates from whatever a previous test left behind.
 *
 * Clearing localStorage before every spec restores the "fresh session"
 * assumption those tests rely on. Specs that manage their own localStorage
 * (auth/token/social) already clear it in their own hooks, so this extra clear
 * is harmless for them.
 *
 * This file has no `describe`; the top-level `beforeEach` registers a root
 * hook that Jasmine applies to every spec in the suite.
 */
beforeEach(() => {
  localStorage.clear();
});
