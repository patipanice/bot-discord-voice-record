import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  TextChannel,
  Events,
  SlashCommandBuilder,
  VoiceChannel,
  ChannelType,
} from "discord.js";
import * as dotenv from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { joinVoiceAndRecord, leaveVoiceChannel } from "./recorder";
import { joinVoiceChannel } from "@discordjs/voice";

dotenv.config();

// ฟังก์ชันสำหรับแปลง userId เป็นชื่อ
async function getUserDisplayName(userId: string, guild: any): Promise<string> {
  try {
    const member = await guild.members.fetch(userId);
    return member.displayName || member.user.username;
  } catch (error) {
    return `User-${userId.slice(-4)}`; // ใช้ 4 ตัวท้ายของ userId
  }
}

// ฟังก์ชันสำหรับแปลง timestamp เป็นเวลาที่อ่านได้
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ตัวแปร global สำหรับเก็บ channel ที่จะส่งข้อความ
let transcriptChannel: TextChannel | null = null;
let isRecording = false; // สถานะการบันทึก
let sessionTranscripts: Array<{
  userId: string;
  transcript: string;
  confidence: number;
  timestamp: string;
}> = []; // เก็บ transcripts ในเซสชัน
let pendingTranscriptions = 0; // จำนวนการแปลงเสียงที่ยังไม่เสร็จ

// ฟังก์ชันสำหรับโหลด channel ที่บันทึกไว้
function loadSavedChannel() {
  try {
    const savedChannelId = readFileSync(
      "recordings/saved_channel.txt",
      "utf8"
    ).trim();
    if (savedChannelId) {
      console.log(`📂 โหลด channel ที่บันทึกไว้: ${savedChannelId}`);
      return savedChannelId;
    }
  } catch (error) {
    console.log(`📂 ไม่พบ channel ที่บันทึกไว้`);
  }
  return null;
}

// ฟังก์ชันสำหรับบันทึก channel
function saveChannel(channelId: string) {
  try {
    writeFileSync("recordings/saved_channel.txt", channelId, "utf8");
    console.log(`💾 บันทึก channel: ${channelId}`);
  } catch (error) {
    console.error(`❌ ไม่สามารถบันทึก channel:`, error);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
  if (client.application) {
    try {
      await client.application.fetch();
      const joinCommand = new SlashCommandBuilder()
        .setName("join")
        .setDescription("Join a voice channel and start recording audio")
        .addChannelOption(
          (option) =>
            option
              .setName("channel")
              .setDescription("The voice channel to join")
              .setRequired(true)
              .addChannelTypes(ChannelType.GuildVoice) // 2 = VoiceChannel type
        )
        .toJSON();
      console.log(`📜 สร้างคำสั่ง join: ${joinCommand.name.toString()}`);
      await client.application.commands.create(joinCommand);
    } catch (error) {
      console.error("❌ ไม่สามารถสร้างคำสั่ง join:", error);
    }
    try {
      await client.application.fetch();
      const leaveCommand = new SlashCommandBuilder()
        .setName("leave")
        .setDescription("Leave the voice channel and stop recording audio")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The voice channel to leave")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .toJSON();
      await client.application.commands.create(leaveCommand);
    } catch (error) {
      console.error("❌ ไม่สามารถสร้างคำสั่ง leave:", error);
    }
  }
  // โหลด channel ที่บันทึกไว้
  const savedChannelId = loadSavedChannel();
  if (savedChannelId) {
    try {
      const channel = (await client.channels.fetch(
        savedChannelId
      )) as TextChannel;
      if (channel && channel.type === 0) {
        // TextChannel type
        transcriptChannel = channel;
        console.log(`✅ โหลด channel ที่บันทึกไว้: ${channel.name}`);
      }
    } catch (error) {
      console.log(`⚠️ ไม่สามารถโหลด channel ที่บันทึกไว้: ${savedChannelId}`);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  console.log(`🔍 ตรวจสอบ Interaction: ${interaction.commandName ?? ""}`);
  try {
    if (interaction.commandName === "join") {
      const voiceChannel = interaction.options.getChannel("channel");
      if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
        await interaction.reply({
          content: "❌ กรุณาเลือก Voice Channel ที่ถูกต้อง",
          ephemeral: true,
        });
        return;
      }
      if (!interaction.guild?.voiceAdapterCreator) {
        await interaction.reply({
          content: "❌ ไม่พบ voice adapter ในเซิร์ฟเวอร์นี้",
          ephemeral: true,
        });
        return;
      }
      if (isRecording) {
        await interaction.reply("⚠️ กำลังบันทึกอยู่แล้ว!");
        return;
      }

      const channel = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });
      console.log(`🔍 ตรวจสอบ: voiceChannel = ${voiceChannel.name}`);

      await joinVoiceAndRecord(
        channel ? (voiceChannel as VoiceChannel) : undefined, // ใช้ channel ถ้ามี
        voiceChannel.id,
        interaction.guild.id,
        interaction.guild.voiceAdapterCreator
      );
      isRecording = true;

      // ส่งข้อความเริ่มบันทึก
      if (transcriptChannel) {
        const embed = new EmbedBuilder()
          .setTitle("🎙️ เริ่มบันทึกเสียง")
          .setDescription(`**${voiceChannel.name}**`)
          .addFields({
            name: "📊 สถานะ",
            value: "🟢 กำลังบันทึก",
            inline: true,
          })
          .addFields({
            name: "⏰ เวลาเริ่ม",
            value: new Date().toLocaleString("th-TH"),
            inline: true,
          })
          .setColor(0x00ff00)
          .setTimestamp()
          .setFooter({
            text: "Voice Recorder Bot",
            iconURL: client.user?.displayAvatarURL(),
          });

        await transcriptChannel.send({ embeds: [embed] });
      }

      await interaction.reply(`📼 เริ่มบันทึกเสียง ${voiceChannel.name} แล้ว!`);
    }
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาดในการเข้าร่วมห้องเสียง:", error);
    if (!interaction.replied) {
      await interaction.reply({
        content: "❌ ไม่สามารถเข้าร่วมห้องเสียงได้",
        ephemeral: true,
      });
    }
  }
    if (interaction.commandName === "leave") {
      console.log(
        `🔍 ตรวจสอบ: sessionTranscripts.length = ${sessionTranscripts.length}`
      );
      console.log(
        `🔍 ตรวจสอบ: transcriptChannel = ${
          transcriptChannel ? transcriptChannel.name : "null"
        }`
      );
      console.log(`🔍 ตรวจสอบ: isRecording = ${isRecording}`);
      console.log(
        `🔍 ตรวจสอบ: pendingTranscriptions = ${pendingTranscriptions}`
      );

      const left = leaveVoiceChannel();
      if (left) {
        // รอให้การแปลงเสียงเสร็จก่อนปิดการบันทึก
        if (pendingTranscriptions > 0) {
          console.log(
            `⏳ รอให้การแปลงเสียงเสร็จ ${pendingTranscriptions} ไฟล์...`
          );
          interaction.reply("⏳ กำลังรอให้การแปลงเสียงเสร็จก่อนส่งสรุป...");

          // รอจนกว่าการแปลงเสียงจะเสร็จ
          while (pendingTranscriptions > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // รอ 1 วินาที
            console.log(
              `⏳ ยังรออยู่... pendingTranscriptions = ${pendingTranscriptions}`
            );
          }
        }
      }
      interaction.reply(`✅ การแปลงเสียงเสร็จแล้ว!`);
    }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.content === "!join" && message.member?.voice.channel) {
    const channel = message.member.voice.channel;
    if (channel.type === 2) {
      // VoiceChannel type
      if (!isRecording) {
        await joinVoiceAndRecord(channel);
        isRecording = true;

        // ส่งข้อความเริ่มบันทึก
        if (transcriptChannel) {
          const embed = new EmbedBuilder()
            .setTitle("🎙️ เริ่มบันทึกเสียง")
            .setDescription(`**${channel.name}**`)
            .addFields({
              name: "📊 สถานะ",
              value: "🟢 กำลังบันทึก",
              inline: true,
            })
            .addFields({
              name: "⏰ เวลาเริ่ม",
              value: new Date().toLocaleString("th-TH"),
              inline: true,
            })
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({
              text: "Voice Recorder Bot",
              iconURL: client.user?.displayAvatarURL(),
            });

          await transcriptChannel.send({ embeds: [embed] });
        }

        message.reply("📼 เริ่มบันทึกเสียงแล้ว!");
      } else {
        message.reply("⚠️ กำลังบันทึกอยู่แล้ว!");
      }
    } else {
      message.reply("❌ สามารถบันทึกเสียงได้เฉพาะใน Voice Channel เท่านั้น");
    }
  }

  if (message.content === "!leave") {
    console.log(
      `🔍 ตรวจสอบ: sessionTranscripts.length = ${sessionTranscripts.length}`
    );
    console.log(
      `🔍 ตรวจสอบ: transcriptChannel = ${
        transcriptChannel ? transcriptChannel.name : "null"
      }`
    );
    console.log(`🔍 ตรวจสอบ: isRecording = ${isRecording}`);
    console.log(`🔍 ตรวจสอบ: pendingTranscriptions = ${pendingTranscriptions}`);

    const left = leaveVoiceChannel();
    if (left) {
      // รอให้การแปลงเสียงเสร็จก่อนปิดการบันทึก
      if (pendingTranscriptions > 0) {
        console.log(
          `⏳ รอให้การแปลงเสียงเสร็จ ${pendingTranscriptions} ไฟล์...`
        );
        message.reply("⏳ กำลังรอให้การแปลงเสียงเสร็จก่อนส่งสรุป...");

        // รอจนกว่าการแปลงเสียงจะเสร็จ
        while (pendingTranscriptions > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // รอ 1 วินาที
          console.log(
            `⏳ ยังรออยู่... pendingTranscriptions = ${pendingTranscriptions}`
          );
        }

        console.log(`✅ การแปลงเสียงเสร็จแล้ว!`);
      }

      // ปิดการบันทึกหลังจากรอเสร็จ
      isRecording = false;

      // ส่งสรุปการประชุม
      console.log(`📤 กำลังส่งสรุปการประชุม...`);
      await sendSessionSummary();

      // ส่งข้อความจบการบันทึก
      if (transcriptChannel) {
        const embed = new EmbedBuilder()
          .setTitle("⏹️ จบการบันทึกเสียง")
          .setDescription("การบันทึกเสียงสิ้นสุดแล้ว")
          .addFields({
            name: "📊 สถานะ",
            value: "🔴 หยุดบันทึก",
            inline: true,
          })
          .addFields({
            name: "⏰ เวลาจบ",
            value: new Date().toLocaleString("th-TH"),
            inline: true,
          })
          .addFields({
            name: "📝 ข้อความที่บันทึก",
            value: `${sessionTranscripts.length} ข้อความ`,
            inline: true,
          })
          .setColor(0xff0000)
          .setTimestamp()
          .setFooter({
            text: "Voice Recorder Bot",
            iconURL: client.user?.displayAvatarURL(),
          });

        await transcriptChannel.send({ embeds: [embed] });
      }

      // รีเซ็ตเซสชัน
      sessionTranscripts = [];
      pendingTranscriptions = 0;

      message.reply("👋 ออกจากห้องเสียงแล้ว!");
    } else {
      message.reply("❌ บอทไม่ได้อยู่ในห้องเสียง");
    }
  }

  if (message.content === "!transcript") {
    const transcriptFile = "recordings/transcripts.txt";
    if (existsSync(transcriptFile)) {
      try {
        const transcriptContent = readFileSync(transcriptFile, "utf8");
        if (transcriptContent.trim()) {
          // แยกบรรทัดและแปลงเป็น embed
          const lines = transcriptContent.trim().split("\n");
          const embed = new EmbedBuilder()
            .setTitle("📝 Voice Transcripts")
            .setDescription("บันทึกการสนทนาภาษาไทยจากห้องเสียง")
            .setColor(0x00ff00) // สีเขียว
            .setTimestamp()
            .setFooter({
              text:
                "Voice Recorder Bot • " + new Date().toLocaleString("th-TH"),
              iconURL: client.user?.displayAvatarURL(),
            });

          // จัดกลุ่ม transcripts ตามผู้พูด
          const groupedTranscripts = new Map<
            string,
            Array<{ transcript: string; confidence: string; timestamp: string }>
          >();

          for (const line of lines) {
            if (line.trim()) {
              // แยกข้อมูล: [timestamp] userId: transcript (confidence)
              const match = line.match(
                /\[(.*?)\] (.*?): (.*?) \(ความแม่นยำ: (.*?)%\)/
              );
              if (match) {
                const [, timestamp, userId, transcript, confidence] = match;

                if (!groupedTranscripts.has(userId)) {
                  groupedTranscripts.set(userId, []);
                }
                groupedTranscripts.get(userId)!.push({
                  transcript,
                  confidence,
                  timestamp,
                });
              }
            }
          }

          // แสดง transcripts จัดกลุ่มตามผู้พูด
          for (const [userId, transcripts] of groupedTranscripts) {
            const displayName = await getUserDisplayName(userId, message.guild);
            const latestTranscript = transcripts[transcripts.length - 1]; // ใช้ข้อความล่าสุด
            const formattedTime = formatTimestamp(latestTranscript.timestamp);

            embed.addFields({
              name: `🎤 ${displayName} • ${formattedTime}`,
              value: `"${latestTranscript.transcript}"\n*ความแม่นยำ: ${latestTranscript.confidence}%*`,
              inline: false,
            });
          }

          message.reply({ embeds: [embed] });
        } else {
          message.reply("📄 ยังไม่มี transcripts ที่บันทึกไว้");
        }
      } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการอ่านไฟล์ transcript:", error);
        message.reply("❌ เกิดข้อผิดพลาดในการอ่านไฟล์ transcript");
      }
    } else {
      message.reply("📄 ยังไม่มีไฟล์ transcripts.txt");
    }
  }

  if (message.content === "!clear") {
    const transcriptFile = "recordings/transcripts.txt";
    if (existsSync(transcriptFile)) {
      try {
        writeFileSync(transcriptFile, "", "utf8");
        message.reply("🗑️ ลบ transcripts ทั้งหมดแล้ว!");
      } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการลบไฟล์ transcript:", error);
        message.reply("❌ เกิดข้อผิดพลาดในการลบไฟล์ transcript");
      }
    } else {
      message.reply("📄 ไม่มีไฟล์ transcripts.txt ให้ลบ");
    }
  }

  if (message.content === "!setchannel") {
    if (message.channel.type === 0) {
      // TextChannel type
      transcriptChannel = message.channel as TextChannel;
      saveChannel(message.channel.id); // บันทึก channel ID
      message.reply(
        `✅ ตั้งค่า channel ${message.channel.name} เป็น channel สำหรับส่ง transcripts อัตโนมัติแล้ว!\n💾 บันทึกการตั้งค่าไว้แล้ว (ไม่ต้องตั้งใหม่ในครั้งต่อไป)`
      );
      console.log(`📤 ตั้งค่า transcriptChannel = ${message.channel.name}`);
    } else {
      message.reply("❌ สามารถตั้งค่าได้เฉพาะใน Text Channel เท่านั้น");
    }
  }

  if (message.content === "!status") {
    const statusEmbed = new EmbedBuilder()
      .setTitle("📊 สถานะระบบ")
      .setColor(0x0099ff)
      .addFields({
        name: "🎙️ สถานะการบันทึก",
        value: isRecording ? "🟢 กำลังบันทึก" : "🔴 หยุดบันทึก",
        inline: true,
      })
      .addFields({
        name: "📤 Channel ที่ตั้งค่า",
        value: transcriptChannel
          ? transcriptChannel.name
          : "❌ ยังไม่ได้ตั้งค่า",
        inline: true,
      })
      .addFields({
        name: "📝 ข้อความในเซสชัน",
        value: `${sessionTranscripts.length} ข้อความ`,
        inline: true,
      })
      .addFields({
        name: "⏳ การแปลงเสียงที่กำลังดำเนินการ",
        value: `${pendingTranscriptions} ไฟล์`,
        inline: true,
      })
      .addFields({
        name: "💾 การตั้งค่าที่บันทึก",
        value: transcriptChannel
          ? "✅ บันทึกแล้ว (ไม่ต้องตั้งใหม่)"
          : "❌ ยังไม่ได้ตั้งค่า",
        inline: true,
      })
      .setTimestamp()
      .setFooter({
        text: "Voice Recorder Bot",
        iconURL: client.user?.displayAvatarURL(),
      });

    message.reply({ embeds: [statusEmbed] });
  }

  if (message.content === "!help") {
    const helpMessage = `🤖 **คำสั่งของ Voice Recorder Bot:**

📼 **!join** - เริ่มบันทึกเสียงในห้องเสียง
👋 **!leave** - จบการบันทึกและออกจากห้องเสียง
📝 **!transcript** - แสดง transcripts แบบ embed สวยงาม
🗑️ **!clear** - ลบ transcripts ทั้งหมด
📤 **!setchannel** - ตั้งค่า channel สำหรับส่ง transcripts อัตโนมัติ
📊 **!status** - ตรวจสอบสถานะระบบ
❓ **!help** - แสดงคำสั่งทั้งหมด

💡 **วิธีใช้งาน:**
1. พิมพ์ \`!setchannel\` ใน channel ที่ต้องการรับ transcripts
2. เข้าร่วม Voice Channel
3. พิมพ์ \`!join\` เพื่อเริ่มบันทึก (จะส่งข้อความเริ่มบันทึก)
4. พูดภาษาไทยในห้องเสียง (จะส่ง transcripts อัตโนมัติ)
5. พิมพ์ \`!leave\` เพื่อจบการบันทึก (จะส่งข้อความจบการบันทึก)

🎯 **ระบบครบถ้วน:**
• 🎙️ **เริ่มบันทึก** - ส่งข้อความเริ่มบันทึก
• 📝 **เก็บ Transcripts** - เก็บข้อความทั้งหมดในเซสชัน
• ⏹️ **จบการบันทึก** - ส่งสรุปการประชุมทั้งหมด
• 📊 **สถานะ** - แสดงสถานะการบันทึก
• 🎯 **ความแม่นยำ** - แสดงความแม่นยำของแต่ละข้อความ`;

    message.reply(helpMessage);
  }
});

// ฟังก์ชันสำหรับเก็บ transcript ในเซสชัน

export async function addSessionTranscript(
  userId: string,
  transcript: string,
  confidence: number
) {
  console.log(`🔍 addSessionTranscript: isRecording = ${isRecording}`);
  console.log(`🔍 addSessionTranscript: transcript = "${transcript}"`);

  if (isRecording) {
    // ตรวจสอบว่ามี transcript เดียวกันจากคนเดียวกันหรือไม่
    const existingIndex = sessionTranscripts.findIndex(
      (item) => item.userId === userId && item.transcript === transcript
    );

    if (existingIndex === -1) {
      // ไม่มีซ้ำ เพิ่มใหม่
      sessionTranscripts.push({
        userId,
        transcript,
        confidence,
        timestamp: new Date().toISOString(),
      });
      console.log(
        `📝 เพิ่ม transcript ในเซสชัน: "${transcript}" (${(
          confidence * 100
        ).toFixed(1)}%)`
      );
      console.log(
        `📊 sessionTranscripts.length = ${sessionTranscripts.length}`
      );
    } else {
      console.log(`⚠️ ข้าม transcript ที่ซ้ำ: "${transcript}"`);
    }
  } else {
    console.log(`⚠️ ไม่เพิ่ม transcript เพราะ isRecording = false`);
  }
}

// ฟังก์ชันสำหรับเพิ่ม/ลดจำนวนการแปลงเสียงที่กำลังดำเนินการ
export function incrementPendingTranscriptions() {
  pendingTranscriptions++;
  console.log(`📈 เพิ่ม pendingTranscriptions = ${pendingTranscriptions}`);
}

export function decrementPendingTranscriptions() {
  if (pendingTranscriptions > 0) {
    pendingTranscriptions--;
    console.log(`📉 ลด pendingTranscriptions = ${pendingTranscriptions}`);
  }
}

// ฟังก์ชันสำหรับส่ง transcripts ทั้งหมดตอนจบ
async function sendSessionSummary() {
  console.log(
    `🔍 sendSessionSummary: transcriptChannel = ${
      transcriptChannel ? transcriptChannel.name : "null"
    }`
  );
  console.log(
    `🔍 sendSessionSummary: sessionTranscripts.length = ${sessionTranscripts.length}`
  );

  if (transcriptChannel && sessionTranscripts.length > 0) {
    try {
      console.log(
        `📋 สร้างสรุปการประชุมสำหรับ ${sessionTranscripts.length} ข้อความ`
      );

      const embed = new EmbedBuilder()
        .setTitle("📋 สรุปการประชุม")
        .setDescription(`**${sessionTranscripts.length}** ข้อความที่บันทึกไว้`)
        .setColor(0x0099ff)
        .setTimestamp()
        .setFooter({
          text: "Voice Recorder Bot",
          iconURL: client.user?.displayAvatarURL(),
        });

      // จัดกลุ่ม transcripts ตามผู้พูด
      const groupedTranscripts = new Map<
        string,
        Array<{ transcript: string; confidence: number; timestamp: string }>
      >();

      for (const item of sessionTranscripts) {
        if (!groupedTranscripts.has(item.userId)) {
          groupedTranscripts.set(item.userId, []);
        }
        groupedTranscripts.get(item.userId)!.push({
          transcript: item.transcript,
          confidence: item.confidence,
          timestamp: item.timestamp,
        });
      }

      // แสดง transcripts จัดกลุ่มตามผู้พูด
      let fieldCount = 0;
      const maxFields = 20;

      for (const [userId, transcripts] of groupedTranscripts) {
        if (fieldCount >= maxFields) break;

        const displayName = await getUserDisplayName(
          userId,
          transcriptChannel.guild
        );
        const latestTranscript = transcripts[transcripts.length - 1]; // ใช้ข้อความล่าสุด

        console.log(`📝 เพิ่ม transcript: ${latestTranscript.transcript}`);
        const formattedTime = formatTimestamp(latestTranscript.timestamp);

        embed.addFields({
          name: `🎤 ${displayName} • ${formattedTime}`,
          value: `"${latestTranscript.transcript}"\n*ความแม่นยำ: ${(
            latestTranscript.confidence * 100
          ).toFixed(1)}%*`,
          inline: false,
        });

        fieldCount++;
      }

      // แสดงข้อความถ้ามี transcripts มากกว่า 20
      if (sessionTranscripts.length > maxFields) {
        embed.addFields({
          name: "📝 ข้อความเพิ่มเติม",
          value: `และอีก ${sessionTranscripts.length - maxFields} ข้อความ...`,
          inline: false,
        });
      }

      await transcriptChannel.send({ embeds: [embed] });
      console.log(
        `✅ ส่งสรุปการประชุมไปยัง ${transcriptChannel.name} (${sessionTranscripts.length} ข้อความ)`
      );
    } catch (error) {
      console.error("❌ เกิดข้อผิดพลาดในการส่งสรุปการประชุม:", error);
    }
  } else {
    console.log(
      `⚠️ ไม่สามารถส่งสรุป: transcriptChannel=${!!transcriptChannel}, sessionTranscripts.length=${
        sessionTranscripts.length
      }`
    );
  }
}

client.login(process.env.DISCORD_TOKEN);
