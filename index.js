import express from "express";
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import Pino from "pino";

import { getPairCode } from "./pair.js";
import {
  BOT_NAME,
  OWNER_NAME,
  PREFIX,
  CHANNEL_NAME,
  CHANNEL_LINK,
  WARN_LIMIT
} from "./config.js";

const app = express();
const badWords = ["fuck", "sex", "mc", "bc"];
let warns = {};

app.get("/", (req, res) => {
  res.send("🤖 CK-ERROR AUTO ADMIN BOT RUNNING");
});

app.get("/pair", async (req, res) => {
  const number = req.query.number;
  if (!number) return res.send("❌ Number missing");
  const code = await getPairCode(number);
  res.send(✅ Pair Code: ${code});
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("group-participants.update", async (data) => {
    const group = data.id;

    for (let user of data.participants) {
      if (data.action === "add") {
        await sock.sendMessage(group, {
          text: `💜 Welcome @${user.split("@")[0]}

👾 ${BOT_NAME}
📢 ${CHANNEL_NAME}
${CHANNEL_LINK}`,
          mentions: [user]
        });
      }

      if (data.action === "remove") {
        await sock.sendMessage(group, {
          text: 👋 Goodbye @${user.split("@")[0]},
          mentions: [user]
        });
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const from = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const text = m.message.conversation || "";

    if (text.includes("chat.whatsapp.com")) {
      await sock.sendMessage(from, { delete: m.key });
      await sock.sendMessage(from, { text: "🚫 Group link not allowed!" });
    }

    for (let word of badWords) {
      if (text.toLowerCase().includes(word)) {
        warns[sender] = (warns[sender] || 0) + 1;

        if (warns[sender] >= WARN_LIMIT) {
          await sock.groupParticipantsUpdate(from, [sender], "remove");
          warns[sender] = 0;
        } else {
          await sock.sendMessage(from, {
            text: ⚠ Warning ${warns[sender]}/${WARN_LIMIT}
          });
        }
      }
    }

    if (!text.startsWith(PREFIX)) return;

    if (text === ".menu") {
      await sock.sendMessage(from, {
        text: `
💜 CK-ERROR AUTO ADMIN 💜
🟣 DARK PURPLE EDITION

👑 Admin:
.kick | .tagall

🛡 Auto:
Anti-Link | Bad Word | Warn + Kick

⚡ Tools:
.menu | .ping | .channel

👑 OWNER
${OWNER_NAME}
`
      });
    }

    if (text === ".ping") {
      await sock.sendMessage(from, { text: "⚡ Bot Online" });
    }

    if (text === ".channel") {
      await sock.sendMessage(from, {
        text: ${CHANNEL_NAME}\n${CHANNEL_LINK}
      });
    }
  });

  console.log("🤖 BOT CONNECTED");
}

startBot();

app.listen(3000, () => {
  console.log("🌐 Server running");
});
