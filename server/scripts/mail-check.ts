import { mailConfig, sendMail, verifyMail } from "../src/lib/mail";

/**
 * Checks the outbound email settings from the server's own environment
 * (ADR-019). Never prints the SMTP password or user.
 *
 *   node dist/cli/mail-check.mjs                 # connect, TLS, authenticate; sends nothing
 *   node dist/cli/mail-check.mjs --to you@x.com  # also sends one plain test message
 */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  const config = mailConfig();
  if (config) console.log(`SMTP ${config.host}:${config.port} (${config.secure ? "implicit TLS" : "STARTTLS required"}), auth ${config.user ? "on" : "off"}, from ${config.from}`);
  const result = await verifyMail();
  if (!result.ok) {
    console.error(`Mail check failed: ${result.error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Connection, TLS and authentication OK.");
  const to = arg("to");
  if (!to) return;
  await sendMail({ to, subject: "GYM RAT mail check", text: "This is a test message from the GYM RAT server. Outbound email works." });
  console.log(`Test message accepted for ${to}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
