// Local development only: prints the current TOTP code for the first enrolled
// admin in the dev database, so the dashboard can be driven without a phone.
import { TOTP, Secret } from "otpauth";
import postgres from "postgres";

import { decryptSecret } from "../../src/lib/auth/crypto";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const rows = await sql`select secret_encrypted from admin_totp limit 1`;
console.log(new TOTP({ secret: Secret.fromBase32(decryptSecret(rows[0].secret_encrypted)), digits: 6, period: 30 }).generate());
await sql.end();
