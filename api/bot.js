require("dotenv").config();
const { Bot, webhookCallback, GrammyError, HttpError } = require("grammy");
const https = require("https");

// Bot

const bot = new Bot(process.env.BOT_TOKEN);

// Admin

const authorizedUsers = process.env.BOT_DEVELOPER?.split(",").map(Number) || [];
bot.use(async (ctx, next) => {
  ctx.config = {
    botDevelopers: authorizedUsers,
    isDeveloper: authorizedUsers.includes(ctx.chat?.id),
  };
  await next();
});

// Commands

bot.command("start", async (ctx) => {
  if (!ctx.chat.type == "private") {
    await bot.api.sendMessage(
      ctx.chat.id,
      "*Channels and groups are not supported presently.*",
      { parse_mode: "Markdown" }
    );
    return;
  }
  await ctx
    .reply("*Welcome!* ✨\n_This is a private utility bot for @anzubo._", {
      parse_mode: "Markdown",
    })
    .then(console.log("New user added:\n", ctx.chat));
});

bot.command("help", async (ctx) => {
  await ctx
    .reply(
      "*@anzubo Project.*\n\n_This is a utility bot for managing Tailscale used by @anzubo.\nUnauthorized use is not permitted._",
      { parse_mode: "Markdown" }
    )
    .then(console.log("Help command sent to", ctx.chat.id));
});

// Misc

bot.command("cmd", async (ctx) => {
  if (!ctx.chat.type == "private") {
    await bot.api.sendMessage(
      ctx.chat.id,
      "*Channels and groups are not supported presently.*",
      { parse_mode: "Markdown" }
    );
    return;
  }
  if (!ctx.config.isDeveloper) {
    await ctx
      .reply("*You are not authorized to use this command.*", {
        parse_mode: "Markdown",
      })
      .then(console.log("Unauthorized use by", ctx.chat.id))
      .catch((e) => console.error(e));
  } else {
    await ctx
      .reply("*Commands*\n\n_1. /list List devices_", {
        parse_mode: "Markdown",
      })
      .then(console.log("Commands list sent to", ctx.chat.id))
      .catch((e) => console.error(e));
  }
});

// Tailscale

bot.command(["list", "l", "ls"], async (ctx) => {
  if (!ctx.chat.type == "private") {
    await bot.api.sendMessage(
      ctx.chat.id,
      "*Channels and groups are not supported presently.*",
      { parse_mode: "Markdown" }
    );
    return;
  }
  if (!ctx.config.isDeveloper) {
    await ctx
      .reply("*You are not authorized to use this command.*", {
        parse_mode: "Markdown",
      })
      .then(console.log("Unauthorized use by", ctx.chat.id));
  } else {
    const apiPath = `/api/v2/tailnet/${process.env.TAILNET}/devices`;

    async function getDevices() {
      const options = {
        hostname: "api.tailscale.com",
        path: apiPath,
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(process.env.TAILSCALE_API_KEY + ":").toString("base64"),
        },
      };

      return new Promise((resolve, reject) => {
        https
          .get(options, (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", () => {
              resolve(data);
            });
          })
          .on("error", (error) => {
            reject(error);
          });
      });
    }

    async function main() {
      try {
        const devices = await getDevices();
        const data = JSON.parse(devices);
        await Promise.all(
          data.devices.map(async (device) => {
            const currentTime = new Date();
            const now = currentTime.toISOString();
            const lastSeen = new Date(device.lastSeen);
            const diffInMinutes =
              (currentTime.getTime() - lastSeen.getTime()) / (1000 * 60);
            let isOnline;
            if (diffInMinutes <= 5) {
              isOnline = `🟢 Connected`;
            } else {
              isOnline = `🔴 Disconnected`;
            }
            const ISTDateString = lastSeen.toLocaleDateString("en-US", {
              timeZone: "Asia/Kolkata",
              weekday: "short",
              month: "short",
              day: "numeric",
            });

            const ISTTimeString = lastSeen
              .toLocaleTimeString("en-US", {
                timeZone: "Asia/Kolkata",
                hour12: true,
              })
              .replace(/:\d{2}\s/, " ");

            const ISTDateTimeString =
              ISTDateString + " " + ISTTimeString + " IST";

            await ctx.reply(
              `${isOnline}\n\n<b>${device.hostname}\n\nAddresses:</b>\n<i>IPv4: <code>${device.addresses[0]}</code>\nIPv6: <code>${device.addresses[1]}</code></i>\n\n<b>Last seen:</b>\n<i>${ISTDateTimeString}</i>`,
              {
                parse_mode: "HTML",
              }
            );
          })
        );
      } catch (error) {
        console.error(error);
      }
    }

    try {
      await main();
    } catch (error) {
      if (error instanceof GrammyError) {
        if (error.message.includes("Forbidden: bot was blocked by the user")) {
          console.log("Bot was blocked by the user");
        } else if (error.message.includes("Call to 'sendMessage' failed!")) {
          console.log("Error sending message: ", error);
          await ctx.reply(`*Error contacting Telegram.*`, {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message.message_id,
          });
        } else {
          await ctx.reply(`*An error occurred: ${error.message}*`, {
            parse_mode: "Markdown",
            reply_to_message_id: ctx.message.message_id,
          });
        }
        console.log(`Error sending message: ${error.message}`);
        return;
      } else {
        console.log(`An error occured:`, error);
        await ctx.reply(`*An error occurred.*\n_Error: ${error.message}_`, {
          parse_mode: "Markdown",
          reply_to_message_id: ctx.message.message_id,
        });
        return;
      }
    }
  }
});

// Messages

bot.on("message", async (ctx) => {
  await ctx.reply(
    "*Direct messages are not supported. Please use commands to interact.*",
    { parse_mode: "Markdown" }
  );
});

// Error

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(
    "Error while handling update",
    ctx.update.update_id,
    "\nQuery:",
    ctx.msg.text
  );
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
    if (e.description === "Forbidden: bot was blocked by the user") {
      console.log("Bot was blocked by the user");
    } else {
      ctx.reply("An error occurred");
    }
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

// Run

export default webhookCallback(bot, "http");
