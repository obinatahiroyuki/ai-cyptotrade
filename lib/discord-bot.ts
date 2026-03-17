import { Client, GatewayIntentBits, type Message, Events } from "discord.js";

export interface DiscordBotConfig {
  token: string;
  channelId: string;
  onMessage: (message: DiscordSignalMessage) => Promise<void>;
}

export interface DiscordSignalMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  channelId: string;
  timestamp: Date;
}

export function createDiscordBot(config: DiscordBotConfig): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[Discord Bot] Logged in as ${c.user.tag}`);
    console.log(`[Discord Bot] Monitoring channel: ${config.channelId}`);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (message.channelId !== config.channelId) return;

    const signalMessage: DiscordSignalMessage = {
      id: message.id,
      content: message.content,
      authorId: message.author.id,
      authorName: message.author.displayName ?? message.author.username,
      channelId: message.channelId,
      timestamp: message.createdAt,
    };

    try {
      await config.onMessage(signalMessage);
    } catch (err) {
      console.error("[Discord Bot] Error processing message:", err);
    }
  });

  return client;
}

export async function startBot(config: DiscordBotConfig): Promise<Client> {
  const client = createDiscordBot(config);
  await client.login(config.token);
  return client;
}
