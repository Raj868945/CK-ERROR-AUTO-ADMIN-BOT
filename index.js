import express from "express";
import makeWASocket, {
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
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

// ===== SETTINGS =====
const badWords = ["fuck", "sex", "mc", "bc"];
let warns = {};

// ===== EXPRESS SERVER =====
app.get("/", (req, res) => {
  res.send("🤖 CK-ERROR V4 ULTRA RUNNING");
});

app.get("/pair", async (req, res) => {
  try {
    const number = req.query.number;
    if (!number) return res.send("❌ Number missing");

    const code = await getPairCode(number);
    res.send(✅ Pair Code: ${code});
  } catch (err) {
    res.send("❌ Pair code generate failed");
  }
});

// ===== WHATSAPP BOT =====
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== WELCOME / GOODBYE =====
  sock.ev.on("group-participants.update", async (data) => {
    const group = data.id;

    for (let user of data.participants) {
      if (data.action === "add") {
        await sock.sendMessage(group, {
          text: `💜 Welcome @${user.split("@")[0]}

👾 ${BOT_NAME}
📢 Follow our channel:
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

  // ===== MESSAGE HANDLER =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;

    const from = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const text =
      m.message.conversation ||
      m.message.extendedTextMessage?.text ||
      "";

    // ===== ANTI-LINK =====
    if (text.includes("chat.whatsapp.com")) {
      await sock.sendMessage(from, { delete: m.key });
      await sock.sendMessage(from, {
        text: "🚫 Group link not allowed!"
      });
      return;
    }

    // ===== BAD WORD + WARN =====
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
        return;
      }
    }

    // ===== COMMANDS =====
    if (!text.startsWith(PREFIX)) return;

    if (text === ${PREFIX}ping) {
      await sock.sendMessage(from, {
        text: "⚡ CK-ERROR ONLINE"
      });
    }

    if (text === ${PREFIX}channel) {
      await sock.sendMessage(from, {
        text: 📢 ${CHANNEL_NAME}\n${CHANNEL_LINK}
      });
    }

    if (text === ${PREFIX}menu) {
      await sock.sendMessage(from, {
        text: `
💜 CK-ERROR AUTO ADMIN 💜
🟣 DARK PURPLE • OMNI • PRO

👑 Admin:
.kick | .promote | .demote | .tagall

🛡 Auto:
Anti-Link | Bad-Word | Warn + Kick

⚡ Tools:
.menu | .ping | .channel

👑 OWNER
${OWNER_NAME}
"SILENT CONTROL • FULL POWER"
`
      });
    }
  });

  console.log("🤖 CK-ERROR V4 ULTRA CONNECTED");
}

startBot();

// ===== SERVER START =====
app.listen(3000, () => {
  console.log("🌐 Server running on port 3000");
});
