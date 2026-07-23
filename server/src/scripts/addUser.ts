/**
 * Admin helper — create an account or reset an existing one:
 *   npm run add-user -w server -- <email-or-number> <name> <password>
 */
import { upsertUser } from "../services/userStore.js";

async function main() {
  const [loginId, username, password] = process.argv.slice(2);
  if (!loginId || !username || !password) {
    console.error("Usage: npm run add-user -w server -- <email-or-number> <name> <password>");
    process.exit(1);
  }
  const record = await upsertUser(loginId, username, password);
  console.log(`Saved account "${record.username}" (${record.loginId}).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
