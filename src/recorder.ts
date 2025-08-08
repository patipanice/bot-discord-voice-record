import {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnection,
} from "@discordjs/voice";
import { VoiceChannel } from "discord.js";
import { createWriteStream } from "fs";
import prism from "prism-media";
import { saveUserAudioStream } from "./utils";

let currentConnection: VoiceConnection | null = null;

export async function joinVoiceAndRecord(
  channel?: VoiceChannel,
  channelId?: string,
  guildId?: string,
  adapterCreator?: any
): Promise<VoiceConnection> {
  const connection = joinVoiceChannel({
    channelId: channelId ?? channel?.id ?? "",
    guildId: guildId ?? channel?.guild.id ?? "",
    adapterCreator: adapterCreator ?? channel?.guild.voiceAdapterCreator,
  });

  currentConnection = connection;

  const receiver = connection.receiver;

  receiver.speaking.on("start", (userId) => {
    console.log(`🎤 ${userId} เริ่มพูด`);

    const audioStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 1000,
      },
    });

    saveUserAudioStream(userId, audioStream);
  });

  return connection;
}

export function leaveVoiceChannel(): boolean {
  if (currentConnection) {
    currentConnection.destroy();
    currentConnection = null;
    console.log("👋 ออกจากห้องเสียงแล้ว");
    return true;
  }
  return false;
}
