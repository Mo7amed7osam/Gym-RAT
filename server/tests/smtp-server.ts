import fs from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";
import tls from "node:tls";

/**
 * A tiny local SMTP server for tests, shaped like Resend's relay on port 465:
 * implicit TLS (self-signed test certificate in ./fixtures, never used
 * anywhere else), AUTH PLAIN with user "resend" and an API-key password,
 * MAIL/RCPT/DATA. It records every command and every accepted message so
 * tests can assert what was sent and how many times. Failure modes reproduce
 * what Resend answers for a wrong key or a temporary problem.
 */

export interface ReceivedMessage {
  from: string;
  to: string[];
  data: string;
}

export interface FakeSmtp {
  port: number;
  messages: ReceivedMessage[];
  commands: string[];
  /** What the next DATA / AUTH should answer; reset with `mode = "ok"`. */
  mode: "ok" | "reject-data";
  close: () => Promise<void>;
}

export async function startFakeSmtp(credentials: { user: string; password: string }): Promise<FakeSmtp> {
  const state: FakeSmtp = { port: 0, messages: [], commands: [], mode: "ok", close: async () => undefined };
  const server = tls.createServer({ key: fs.readFileSync(path.join(__dirname, "fixtures/smtp-test.key")), cert: fs.readFileSync(path.join(__dirname, "fixtures/smtp-test.crt")) }, (socket) => {
    let buffer = "";
    let inData = false;
    let data = "";
    let from = "";
    let to: string[] = [];
    let authed = false;
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply("220 smtp.fake-resend.test ESMTP");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            if (state.mode === "reject-data") {
              reply("451 4.3.0 Temporary failure, try again later");
            } else {
              state.messages.push({ from, to, data });
              reply("250 2.0.0 Ok: queued");
            }
            data = "";
          } else {
            data += `${line.startsWith("..") ? line.slice(1) : line}\r\n`;
          }
          continue;
        }
        const upper = line.toUpperCase();
        state.commands.push(upper.startsWith("AUTH") ? "AUTH ***" : upper.split(" ")[0]);
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-smtp.fake-resend.test\r\n250-AUTH PLAIN\r\n250-8BITMIME\r\n250 SMTPUTF8\r\n");
        } else if (upper.startsWith("AUTH PLAIN")) {
          const [, user, password] = Buffer.from(line.slice("AUTH PLAIN ".length), "base64").toString("utf8").split("\u0000");
          authed = user === credentials.user && password === credentials.password;
          // Echo the attempted key back, as some relays do, so tests prove it is redacted.
          reply(authed ? "235 2.7.0 Authentication successful" : `535 5.7.8 Authentication failed for ${user}:${password}`);
        } else if (upper.startsWith("MAIL FROM")) {
          if (!authed) reply("530 5.7.0 Authentication required");
          else {
            from = line.slice(10).trim();
            to = [];
            reply("250 2.1.0 Ok");
          }
        } else if (upper.startsWith("RCPT TO")) {
          to.push(line.slice(8).trim());
          reply("250 2.1.5 Ok");
        } else if (upper === "DATA") {
          inData = true;
          reply("354 End data with <CR><LF>.<CR><LF>");
        } else if (upper === "RSET" || upper === "NOOP") {
          reply("250 2.0.0 Ok");
        } else if (upper === "QUIT") {
          reply("221 2.0.0 Bye");
          socket.end();
        } else {
          reply("502 5.5.2 Command not recognized");
        }
      }
    });
    socket.on("error", () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  state.port = (server.address() as AddressInfo).port;
  state.close = () => new Promise((resolve) => server.close(() => resolve()));
  return state;
}

/** Decoded body parts of a raw MIME message (quoted-printable and base64 handled). */
export function mimeParts(raw: string): { type: string; body: string }[] {
  const boundary = raw.match(/boundary="?([^";\r\n]+)"?/i)?.[1];
  const sections = boundary ? raw.split(`--${boundary}`).slice(1, -1) : [raw];
  return sections.map((section) => {
    const split = section.indexOf("\r\n\r\n");
    const headers = section.slice(0, split);
    let body = section.slice(split + 4);
    const type = headers.match(/content-type:\s*([^;\r\n]+)/i)?.[1]?.trim().toLowerCase() ?? "text/plain";
    const encoding = headers.match(/content-transfer-encoding:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();
    if (encoding === "base64") body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    else if (encoding === "quoted-printable") body = Buffer.from(body.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))), "latin1").toString("utf8");
    return { type, body };
  });
}
