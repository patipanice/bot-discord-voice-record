import { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder, TextChannel, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } from 'discord.js'
import * as dotenv from 'dotenv'
import { joinVoiceAndRecord, leaveVoiceChannel } from './recorder'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { matchTasksWithSpeech, TaskMatch } from './task-matcher'
import { clickUpAPI, searchAllTeamTasks, searchUserTasksByEmail, updateTaskStatusById } from './clickup-api'

dotenv.config()

// ฟังก์ชันสำหรับแปลง userId เป็นชื่อ
async function getUserDisplayName(userId: string, guild: any): Promise<string> {
  try {
    const member = await guild.members.fetch(userId)
    return member.displayName || member.user.username
  } catch (error) {
    return `User-${userId.slice(-4)}` // ใช้ 4 ตัวท้ายของ userId
  }
}

// ฟังก์ชันสำหรับแปลง timestamp เป็นเวลาที่อ่านได้
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// ตัวแปร global สำหรับเก็บ channel ที่จะส่งข้อความ
let transcriptChannel: TextChannel | null = null
let isRecording = false // สถานะการบันทึก
let sessionTranscripts: Array<{userId: string, transcript: string, confidence: number, timestamp: string}> = [] // เก็บ transcripts ในเซสชัน
let pendingTranscriptions = 0 // จำนวนการแปลงเสียงที่ยังไม่เสร็จ

// ตัวแปรสำหรับ ClickUp integration
let clickUpEnabled = false // สถานะการเปิดใช้ ClickUp
let userClickUpTasks: Array<{id: string, name: string, description?: string, url: string}> = [] // Cache tasks ของ user
let userMapping: Record<string, string> = {} // Discord ID → ClickUp email mapping

// ฟังก์ชันสำหรับโหลด channel ที่บันทึกไว้
function loadSavedChannel() {
  try {
    const savedChannelId = readFileSync('recordings/saved_channel.txt', 'utf8').trim()
    if (savedChannelId) {
      console.log(`📂 โหลด channel ที่บันทึกไว้: ${savedChannelId}`)
      return savedChannelId
    }
  } catch (error) {
    console.log(`📂 ไม่พบ channel ที่บันทึกไว้`)
  }
  return null
}

// ฟังก์ชันสำหรับบันทึก channel
function saveChannel(channelId: string) {
  try {
    writeFileSync('recordings/saved_channel.txt', channelId, 'utf8')
    console.log(`💾 บันทึก channel: ${channelId}`)
  } catch (error) {
    console.error(`❌ ไม่สามารถบันทึก channel:`, error)
  }
}

// ฟังก์ชันโหลด user mapping จากไฟล์
function loadUserMapping(): void {
  try {
    if (existsSync('config/user-mapping.json')) {
      const mappingData = readFileSync('config/user-mapping.json', 'utf8')
      userMapping = JSON.parse(mappingData)
      console.log(`📋 โหลด user mapping: ${Object.keys(userMapping).length} users`)
    } else {
      console.log('📋 ไม่พบ config/user-mapping.json สร้างไฟล์ใหม่')
      userMapping = {}
      saveUserMapping()
    }
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการโหลด user mapping:', error)
    userMapping = {}
  }
}

// ฟังก์ชันบันทึก user mapping ลงไฟล์
function saveUserMapping(): void {
  try {
    writeFileSync('config/user-mapping.json', JSON.stringify(userMapping, null, 2), 'utf8')
    console.log('💾 บันทึก user mapping')
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการบันทึก user mapping:', error)
  }
}

// ฟังก์ชันเริ่มต้น ClickUp integration
async function initializeClickUp(): Promise<boolean> {
  try {
    console.log('🔗 เริ่มต้น ClickUp integration...')
    
    // โหลด user mapping
    loadUserMapping()
    
    // ทดสอบการเชื่อมต่อ
    const connected = await clickUpAPI.testConnection()
    if (!connected) {
      console.log('⚠️ ไม่สามารถเชื่อมต่อ ClickUp API')
      return false
    }
    
    clickUpEnabled = true
    console.log('✅ ClickUp integration พร้อมใช้งาน')
    return true
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการเริ่มต้น ClickUp:', error)
    return false
  }
}

// ฟังก์ชันโหลด tasks ของ user จาก ClickUp
async function loadUserTasks(email: string): Promise<void> {
  try {
    console.log(`📋 โหลด tasks ของ user: ${email}`)
    
    const tasks = await searchUserTasksByEmail(email, {
      include_closed: false
    })
    
    userClickUpTasks = tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      url: task.url
    }))
    
    console.log(`✅ โหลด ${userClickUpTasks.length} tasks`)
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการโหลด tasks:', error)
    userClickUpTasks = []
  }
}

// ฟังก์ชันประมวลผล Task Matching
async function processTaskMatching(userId: string, transcript: string, confidence: number): Promise<void> {
  try {
    console.log(`🎯 ประมวลผล Task Matching: "${transcript}"`)
    
    // Match transcript กับ tasks
    const matchResult = matchTasksWithSpeech(transcript, userClickUpTasks)
    
    if (matchResult.matches.length > 0) {
      console.log(`✅ พบ ${matchResult.matches.length} task matches`)
      
      // เอาเฉพาะ matches ที่มี confidence medium ขึ้นไป
      const goodMatches = matchResult.matches.filter(match => 
        match.confidence === 'high' || match.confidence === 'medium'
      )
      
      if (goodMatches.length > 0 && transcriptChannel) {
        await sendTaskMatchSuggestion(userId, transcript, goodMatches)
      }
    } else {
      console.log(`⚠️ ไม่พบ task matches สำหรับ: "${transcript}"`)
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการประมวลผล Task Matching:', error)
  }
}

// ฟังก์ชันส่งข้อเสนอแนะ Task Matching ไปยัง Discord
async function sendTaskMatchSuggestion(userId: string, transcript: string, matches: TaskMatch[]): Promise<void> {
  try {
    if (!transcriptChannel) return
    
    const user = await client.users.fetch(userId)
    const topMatch = matches[0]
    
    // สร้าง embed สำหรับแสดงผล
    const embed = new EmbedBuilder()
      .setTitle('🎯 Task Match Found!')
      .setDescription(`**${user.displayName || user.username}** พูดว่า: "${transcript}"`)
      .addFields({
        name: '📋 Task ที่เข้าใจที่สุด',
        value: `**${topMatch.taskName}**\nความมั่นใจ: ${(topMatch.matchScore * 100).toFixed(1)}% (${topMatch.confidence})\n[ดู Task ใน ClickUp](${topMatch.taskUrl})`,
        inline: false
      })
      .addFields({
        name: '🔍 Keywords ที่จับได้',
        value: topMatch.matchedKeywords.join(', ') || 'ไม่มี',
        inline: true
      })
      .addFields({
        name: '🗣️ ภาษา',
        value: matches[0] ? 'ไทย+อังกฤษ' : 'ไม่ระบุ',
        inline: true
      })
      .setColor(topMatch.confidence === 'high' ? 0x00ff00 : 0xffa500) // เขียวสำหรับ high, ส้มสำหรับ medium
      .setTimestamp()
      .setFooter({
        text: 'ClickUp Task Matching',
        iconURL: client.user?.displayAvatarURL()
      })
    
    // สร้าง buttons สำหรับ user interaction
    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`complete_task_${topMatch.taskId}`)
          .setLabel('✅ Mark Complete')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`progress_task_${topMatch.taskId}`)
          .setLabel('📝 Set To Do')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ignore_match_${topMatch.taskId}`)
          .setLabel('❌ Ignore')
          .setStyle(ButtonStyle.Secondary)
      )
    
    // ส่งข้อความไปยัง Discord
    await transcriptChannel.send({ 
      embeds: [embed], 
      components: [buttons]
    })
    
    console.log(`📤 ส่ง Task Match suggestion: ${topMatch.taskName}`)
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการส่ง Task Match suggestion:', error)
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user?.tag}`)
  
  // โหลด channel ที่บันทึกไว้
  const savedChannelId = loadSavedChannel()
  if (savedChannelId) {
    try {
      const channel = await client.channels.fetch(savedChannelId) as TextChannel
      if (channel && channel.type === 0) { // TextChannel type
        transcriptChannel = channel
        console.log(`✅ โหลด channel ที่บันทึกไว้: ${channel.name}`)
      }
    } catch (error) {
      console.log(`⚠️ ไม่สามารถโหลด channel ที่บันทึกไว้: ${savedChannelId}`)
    }
  }
  
  // เริ่มต้น ClickUp integration
  await initializeClickUp()
})

client.on('messageCreate', async (message) => {
  if (message.content === '!join' && message.member?.voice.channel) {
    const channel = message.member.voice.channel
    if (channel.type === 2) { // VoiceChannel type
      if (!isRecording) {
        await joinVoiceAndRecord(channel)
        isRecording = true
        
        // ส่งข้อความเริ่มบันทึก
        if (transcriptChannel) {
          const embed = new EmbedBuilder()
            .setTitle('🎙️ เริ่มบันทึกเสียง')
            .setDescription(`**${channel.name}**`)
            .addFields({
              name: '📊 สถานะ',
              value: '🟢 กำลังบันทึก',
              inline: true
            })
            .addFields({
              name: '⏰ เวลาเริ่ม',
              value: new Date().toLocaleString('th-TH'),
              inline: true
            })
            .setColor(0x00ff00)
            .setTimestamp()
            .setFooter({ 
              text: 'Voice Recorder Bot',
              iconURL: client.user?.displayAvatarURL()
            })

          await transcriptChannel.send({ embeds: [embed] })
        }
      } else {
        message.reply('⚠️ กำลังบันทึกอยู่แล้ว!')
      }
    } else {
      message.reply('❌ สามารถบันทึกเสียงได้เฉพาะใน Voice Channel เท่านั้น')
    }
  }
  
  if (message.content === '!leave') {
    console.log(`🔍 ตรวจสอบ: sessionTranscripts.length = ${sessionTranscripts.length}`)
    console.log(`🔍 ตรวจสอบ: transcriptChannel = ${transcriptChannel ? transcriptChannel.name : 'null'}`)
    console.log(`🔍 ตรวจสอบ: isRecording = ${isRecording}`)
    console.log(`🔍 ตรวจสอบ: pendingTranscriptions = ${pendingTranscriptions}`)
    
    const left = leaveVoiceChannel()
    if (left) {
      // รอให้การแปลงเสียงเสร็จก่อนปิดการบันทึก
      if (pendingTranscriptions > 0) {
        console.log(`⏳ รอให้การแปลงเสียงเสร็จ ${pendingTranscriptions} ไฟล์...`)
        message.reply('⏳ กำลังรอให้การแปลงเสียงเสร็จก่อนส่งสรุป...')
        
        // รอจนกว่าการแปลงเสียงจะเสร็จ
        while (pendingTranscriptions > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // รอ 1 วินาที
          console.log(`⏳ ยังรออยู่... pendingTranscriptions = ${pendingTranscriptions}`)
        }
        
        console.log(`✅ การแปลงเสียงเสร็จแล้ว!`)
      }
      
      // ปิดการบันทึกหลังจากรอเสร็จ
      isRecording = false
      
      // ส่งสรุปการประชุม
      console.log(`📤 กำลังส่งสรุปการประชุม...`)
      await sendSessionSummary()
      
      // ส่งข้อความจบการบันทึก
      if (transcriptChannel) {
        const embed = new EmbedBuilder()
          .setTitle('⏹️ จบการบันทึกเสียง')
          .setDescription('การบันทึกเสียงสิ้นสุดแล้ว')
          .addFields({
            name: '📊 สถานะ',
            value: '🔴 หยุดบันทึก',
            inline: true
          })
          .addFields({
            name: '⏰ เวลาจบ',
            value: new Date().toLocaleString('th-TH'),
            inline: true
          })
          .addFields({
            name: '📝 ข้อความที่บันทึก',
            value: `${sessionTranscripts.length} ข้อความ`,
            inline: true
          })
          .setColor(0xff0000)
          .setTimestamp()
          .setFooter({ 
            text: 'Voice Recorder Bot',
            iconURL: client.user?.displayAvatarURL()
          })

        await transcriptChannel.send({ embeds: [embed] })
      }
      
      // รีเซ็ตเซสชัน
      sessionTranscripts = []
      pendingTranscriptions = 0
      
      message.reply('👋 ออกจากห้องเสียงแล้ว!')
    } else {
      message.reply('❌ บอทไม่ได้อยู่ในห้องเสียง')
    }
  }
  
  if (message.content === '!transcript') {
    const transcriptFile = 'recordings/transcripts.txt'
    if (existsSync(transcriptFile)) {
      try {
        const transcriptContent = readFileSync(transcriptFile, 'utf8')
        if (transcriptContent.trim()) {
          // แยกบรรทัดและแปลงเป็น embed
          const lines = transcriptContent.trim().split('\n')
          const embed = new EmbedBuilder()
            .setTitle('📝 Voice Transcripts')
            .setDescription('บันทึกการสนทนาภาษาไทยจากห้องเสียง')
            .setColor(0x00ff00) // สีเขียว
            .setTimestamp()
            .setFooter({ 
              text: 'Voice Recorder Bot • ' + new Date().toLocaleString('th-TH'),
              iconURL: client.user?.displayAvatarURL()
            })

          // จัดกลุ่ม transcripts ตามผู้พูด
          const groupedTranscripts = new Map<string, Array<{transcript: string, confidence: string, timestamp: string}>>()
          
          for (const line of lines) {
            if (line.trim()) {
              // แยกข้อมูล: [timestamp] userId: transcript (confidence)
              const match = line.match(/\[(.*?)\] (.*?): (.*?) \(ความแม่นยำ: (.*?)%\)/)
              if (match) {
                const [, timestamp, userId, transcript, confidence] = match
                
                if (!groupedTranscripts.has(userId)) {
                  groupedTranscripts.set(userId, [])
                }
                groupedTranscripts.get(userId)!.push({
                  transcript,
                  confidence,
                  timestamp
                })
              }
            }
          }
          
          // แสดง transcripts จัดกลุ่มตามผู้พูด
          for (const [userId, transcripts] of groupedTranscripts) {
            const displayName = await getUserDisplayName(userId, message.guild)
            const latestTranscript = transcripts[transcripts.length - 1] // ใช้ข้อความล่าสุด
            const formattedTime = formatTimestamp(latestTranscript.timestamp)
            
            embed.addFields({
              name: `🎤 ${displayName} • ${formattedTime}`,
              value: `"${latestTranscript.transcript}"\n*ความแม่นยำ: ${latestTranscript.confidence}%*`,
              inline: false
            })
          }

          message.reply({ embeds: [embed] })
        } else {
          message.reply('📄 ยังไม่มี transcripts ที่บันทึกไว้')
        }
      } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการอ่านไฟล์ transcript:', error)
        message.reply('❌ เกิดข้อผิดพลาดในการอ่านไฟล์ transcript')
      }
    } else {
      message.reply('📄 ยังไม่มีไฟล์ transcripts.txt')
    }
  }
  
  if (message.content === '!clear') {
    const transcriptFile = 'recordings/transcripts.txt'
    if (existsSync(transcriptFile)) {
      try {
        writeFileSync(transcriptFile, '', 'utf8')
        message.reply('🗑️ ลบ transcripts ทั้งหมดแล้ว!')
      } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการลบไฟล์ transcript:', error)
        message.reply('❌ เกิดข้อผิดพลาดในการลบไฟล์ transcript')
      }
    } else {
      message.reply('📄 ไม่มีไฟล์ transcripts.txt ให้ลบ')
    }
  }
  
  if (message.content === '!setchannel') {
    if (message.channel.type === 0) { // TextChannel type
      transcriptChannel = message.channel as TextChannel
      saveChannel(message.channel.id) // บันทึก channel ID
      message.reply(`✅ ตั้งค่า channel ${message.channel.name} เป็น channel สำหรับส่ง transcripts อัตโนมัติแล้ว!\n💾 บันทึกการตั้งค่าไว้แล้ว (ไม่ต้องตั้งใหม่ในครั้งต่อไป)`)
      console.log(`📤 ตั้งค่า transcriptChannel = ${message.channel.name}`)
    } else {
      message.reply('❌ สามารถตั้งค่าได้เฉพาะใน Text Channel เท่านั้น')
    }
  }
  
  if (message.content === '!status') {
    const statusEmbed = new EmbedBuilder()
      .setTitle('📊 สถานะระบบ')
      .setColor(0x0099ff)
      .addFields({
        name: '🎙️ สถานะการบันทึก',
        value: isRecording ? '🟢 กำลังบันทึก' : '🔴 หยุดบันทึก',
        inline: true
      })
      .addFields({
        name: '📤 Channel ที่ตั้งค่า',
        value: transcriptChannel ? transcriptChannel.name : '❌ ยังไม่ได้ตั้งค่า',
        inline: true
      })
      .addFields({
        name: '📝 ข้อความในเซสชัน',
        value: `${sessionTranscripts.length} ข้อความ`,
        inline: true
      })
      .addFields({
        name: '⏳ การแปลงเสียงที่กำลังดำเนินการ',
        value: `${pendingTranscriptions} ไฟล์`,
        inline: true
      })
      .addFields({
        name: '💾 การตั้งค่าที่บันทึก',
        value: transcriptChannel ? '✅ บันทึกแล้ว (ไม่ต้องตั้งใหม่)' : '❌ ยังไม่ได้ตั้งค่า',
        inline: true
      })
      .setTimestamp()
      .setFooter({ 
        text: 'Voice Recorder Bot',
        iconURL: client.user?.displayAvatarURL()
      })
    
    message.reply({ embeds: [statusEmbed] })
  }
  
  if (message.content === '!help') {
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
• 🎯 **ความแม่นยำ** - แสดงความแม่นยำของแต่ละข้อความ`
    
    message.reply(helpMessage)
  }
})

// ฟังก์ชันสำหรับเก็บ transcript ในเซสชัน
export async function addSessionTranscript(userId: string, transcript: string, confidence: number) {
  console.log(`🔍 addSessionTranscript: isRecording = ${isRecording}`)
  console.log(`🔍 addSessionTranscript: transcript = "${transcript}"`)
  
  // เก็บ transcript ทุกครั้งจนกว่าจะ clear session
  const existingIndex = sessionTranscripts.findIndex(
    item => item.userId === userId && item.transcript === transcript
  )
  
  if (existingIndex === -1) {
    // ไม่มีซ้ำ เพิ่มใหม่
    sessionTranscripts.push({
      userId,
      transcript,
      confidence,
      timestamp: new Date().toISOString()
    })
    console.log(`📝 เพิ่ม transcript ในเซสชัน: "${transcript}" (${(confidence * 100).toFixed(1)}%)`)
    console.log(`📊 sessionTranscripts.length = ${sessionTranscripts.length}`)
  } else {
    console.log(`⚠️ ข้าม transcript ที่ซ้ำ: "${transcript}"`)
  }
  
  if (!isRecording) {
    console.log(`⚠️ ไม่เพิ่ม transcript เพราะ isRecording = false`)
  }
}

// ฟังก์ชันสำหรับเพิ่ม/ลดจำนวนการแปลงเสียงที่กำลังดำเนินการ
export function incrementPendingTranscriptions() {
  pendingTranscriptions++
  console.log(`📈 เพิ่ม pendingTranscriptions = ${pendingTranscriptions}`)
}

export function decrementPendingTranscriptions() {
  if (pendingTranscriptions > 0) {
    pendingTranscriptions--
    console.log(`📉 ลด pendingTranscriptions = ${pendingTranscriptions}`)
  }
}

// ฟังก์ชันสำหรับส่ง transcripts ทั้งหมดตอนจบ
async function sendSessionSummary() {
  console.log(`🔍 sendSessionSummary: transcriptChannel = ${transcriptChannel ? transcriptChannel.name : 'null'}`)
  console.log(`🔍 sendSessionSummary: sessionTranscripts.length = ${sessionTranscripts.length}`)
  
  if (transcriptChannel && sessionTranscripts.length > 0) {
    try {
      console.log(`📋 สร้างสรุปการประชุมสำหรับ ${sessionTranscripts.length} ข้อความ`)
      
      const embed = new EmbedBuilder()
        .setTitle('📋 สรุปการประชุม')
        .setDescription(`**${sessionTranscripts.length}** ข้อความที่บันทึกไว้`)
        .setColor(0x0099ff)
        .setTimestamp()
        .setFooter({ 
          text: 'Voice Recorder Bot',
          iconURL: client.user?.displayAvatarURL()
        })

      // จัดกลุ่ม transcripts ตามผู้พูด
      const groupedTranscripts = new Map<string, Array<{transcript: string, confidence: number, timestamp: string}>>()
      
      for (const item of sessionTranscripts) {
        if (!groupedTranscripts.has(item.userId)) {
          groupedTranscripts.set(item.userId, [])
        }
        groupedTranscripts.get(item.userId)!.push({
          transcript: item.transcript,
          confidence: item.confidence,
          timestamp: item.timestamp
        })
      }
      
      // แสดง transcripts จัดกลุ่มตามผู้พูด
      let fieldCount = 0
      const maxFields = 20
      
      for (const [userId, transcripts] of groupedTranscripts) {
        if (fieldCount >= maxFields) break
        
        const displayName = await getUserDisplayName(userId, transcriptChannel.guild)
        const latestTranscript = transcripts[transcripts.length - 1] // ใช้ข้อความล่าสุด
        
        console.log(`📝 เพิ่ม transcript: ${latestTranscript.transcript}`)
        const formattedTime = formatTimestamp(latestTranscript.timestamp)
        
        embed.addFields({
          name: `🎤 ${displayName} • ${formattedTime}`,
          value: `"${latestTranscript.transcript}"\n*ความแม่นยำ: ${(latestTranscript.confidence * 100).toFixed(1)}%*`,
          inline: false
        })
        
        fieldCount++
      }
      
      // แสดงข้อความถ้ามี transcripts มากกว่า 20
      if (sessionTranscripts.length > maxFields) {
        embed.addFields({
          name: '📝 ข้อความเพิ่มเติม',
          value: `และอีก ${sessionTranscripts.length - maxFields} ข้อความ...`,
          inline: false
        })
      }

      await transcriptChannel.send({ embeds: [embed] })
      console.log(`✅ ส่งสรุปการประชุมไปยัง ${transcriptChannel.name} (${sessionTranscripts.length} ข้อความ)`)
      
      // *** เพิ่ม Task Matching หลังส่งสรุปแล้ว ***
      if (clickUpEnabled && Object.keys(userMapping).length > 0) {
        await processAllTaskMatching()
      }
      
      // Clear session หลังส่งสรุปและ task matching เสร็จ
      sessionTranscripts = []
      console.log(`🧹 ล้าง sessionTranscripts แล้ว`)
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการส่งสรุปการประชุม:', error)
    }
  } else {
    console.log(`⚠️ ไม่สามารถส่งสรุป: transcriptChannel=${!!transcriptChannel}, sessionTranscripts.length=${sessionTranscripts.length}`)
  }
}

// ฟังก์ชันประมวลผล Task Matching สำหรับทุก users ในเซสชัน
async function processAllTaskMatching(): Promise<void> {
  try {
    console.log('🎯 เริ่มประมวลผล Task Matching สำหรับทุกคน...')
    
    if (!transcriptChannel) return
    
    // รวบรวม transcripts ของแต่ละ user ที่มี mapping
    const userTranscripts = new Map<string, string[]>()
    
    for (const transcript of sessionTranscripts) {
      const email = userMapping[transcript.userId]
      if (email) {
        if (!userTranscripts.has(email)) {
          userTranscripts.set(email, [])
        }
        userTranscripts.get(email)!.push(transcript.transcript)
      }
    }
    
    console.log(`📋 พบ ${userTranscripts.size} users ที่มี mapping`)
    
    // ประมวลผลแต่ละ user
    for (const [email, transcripts] of userTranscripts) {
      await processUserTaskMatching(email, transcripts)
      
      // รอสักหน่อยระหว่าง users เพื่อไม่ให้ spam
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการประมวลผล Task Matching:', error)
  }
}

// ฟังก์ชันประมวลผล Task Matching สำหรับ user คนหนึ่ง
async function processUserTaskMatching(email: string, transcripts: string[]): Promise<void> {
  try {
    console.log(`👤 ประมวลผล Task Matching สำหรับ: ${email}`)
    
    // โหลด tasks ทั้งหมดในทีม (แทนที่จะหาเฉพาะ assigned tasks)
    const tasks = await searchAllTeamTasks({
      include_closed: false
    })
    
    if (tasks.length === 0) {
      console.log(`⚠️ ไม่พบ tasks ในทีม`)
      return
    }
    
    console.log(`📋 พบ ${tasks.length} tasks ในทีม สำหรับการ match กับ ${email}`)
    
    // รวม transcripts ทั้งหมดของ user
    const combinedTranscript = transcripts.join(' ')
    
    // ทำ Task Matching
    const taskData = tasks.map(task => ({
      id: task.id,
      name: task.name,
      description: task.description,
      url: task.url
    }))
    
    const matchResult = matchTasksWithSpeech(combinedTranscript, taskData)
    
    if (matchResult.matches.length > 0) {
      // เอาแค่ matches ที่ confidence medium ขึ้นไป
      const goodMatches = matchResult.matches.filter(match => 
        match.confidence === 'high' || match.confidence === 'medium'
      )
      
      if (goodMatches.length > 0) {
        await sendUserTaskMatches(email, transcripts, goodMatches)
      }
    }
    
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการประมวลผล ${email}:`, error)
  }
}

// ฟังก์ชันส่ง Task Matches ของ user
async function sendUserTaskMatches(email: string, transcripts: string[], matches: TaskMatch[]): Promise<void> {
  try {
    if (!transcriptChannel) return
    
    const topMatch = matches[0]
    
    // หา Discord user จาก email mapping
    const discordUserId = Object.keys(userMapping).find(id => userMapping[id] === email)
    let userDisplayName = email
    
    if (discordUserId) {
      try {
        const user = await client.users.fetch(discordUserId)
        userDisplayName = user.displayName || user.username
      } catch (error) {
        console.log(`⚠️ ไม่สามารถหา Discord user: ${discordUserId}`)
      }
    }
    
    // สร้าง embed สำหรับแสดงผล
    const embed = new EmbedBuilder()
      .setTitle('🎯 Task Match Found!')
      .setDescription(`**${userDisplayName}** (${email})`)
      .addFields({
        name: '🗣️ สิ่งที่พูด',
        value: transcripts.slice(0, 3).map(t => `"${t}"`).join('\n') + (transcripts.length > 3 ? `\n... และอีก ${transcripts.length - 3} ข้อความ` : ''),
        inline: false
      })
      .addFields({
        name: '📋 Task ที่เข้าใจที่สุด',
        value: `**${topMatch.taskName}**\nความมั่นใจ: ${(topMatch.matchScore * 100).toFixed(1)}% (${topMatch.confidence})\n[ดู Task ใน ClickUp](${topMatch.taskUrl})`,
        inline: false
      })
      .addFields({
        name: '🔍 Keywords ที่จับได้',
        value: topMatch.matchedKeywords.join(', ') || 'ไม่มี',
        inline: true
      })
      .setColor(topMatch.confidence === 'high' ? 0x00ff00 : 0xffa500)
      .setTimestamp()
      .setFooter({
        text: 'ClickUp Task Matching',
        iconURL: client.user?.displayAvatarURL()
      })
    
    // สร้าง buttons สำหรับ user interaction
    const buttons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`complete_task_${topMatch.taskId}`)
          .setLabel('✅ Mark Complete')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`progress_task_${topMatch.taskId}`)
          .setLabel('📝 Set To Do')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`ignore_match_${topMatch.taskId}`)
          .setLabel('❌ Ignore')
          .setStyle(ButtonStyle.Secondary)
      )
    
    // ส่งข้อความไปยัง Discord
    await transcriptChannel.send({ 
      embeds: [embed], 
      components: [buttons]
    })
    
    console.log(`📤 ส่ง Task Match สำหรับ ${userDisplayName}: ${topMatch.taskName}`)
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการส่ง Task Matches:', error)
  }
}

// Handle button interactions สำหรับ ClickUp task updates
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return
  
  const { customId, user } = interaction
  
  // Parse customId: complete_task_taskId, progress_task_taskId, ignore_match_taskId
  const [action, , taskId] = customId.split('_')
  
  if (!taskId) {
    await interaction.reply({ content: '❌ Invalid task ID', ephemeral: true })
    return
  }
  
  try {
    await interaction.deferReply({ ephemeral: true })
    
    if (action === 'complete') {
      // อัปเดทสถานะเป็น Complete
      const updatedTask = await updateTaskStatusById(taskId, 'complete')
      
      if (updatedTask) {
        await interaction.editReply({
          content: `✅ **${updatedTask.name}** ถูกอัปเดทเป็น **Complete** แล้ว!`
        })
        
        // อัปเดท embed เดิมให้แสดงว่าทำเสร็จแล้ว
        const embed = new EmbedBuilder()
          .setTitle('✅ Task Completed!')
          .setDescription(`Task **${updatedTask.name}** ได้รับการอัปเดทเป็น Complete โดย ${user.displayName || user.username}`)
          .setColor(0x00ff00)
          .setTimestamp()
        
        await interaction.message.edit({ embeds: [embed], components: [] })
      } else {
        await interaction.editReply({
          content: '❌ ไม่สามารถอัปเดท task status ได้ กรุณาลองใหม่'
        })
      }
      
    } else if (action === 'progress') {
      // อัปเดทสถานะเป็น To Do (เนื่องจาก ClickUp ไม่มี "in progress")
      const updatedTask = await updateTaskStatusById(taskId, 'to do')
      
      if (updatedTask) {
        await interaction.editReply({
          content: `🔄 **${updatedTask.name}** ถูกอัปเดทเป็น **To Do** แล้ว!`
        })
        
        // อัปเดท embed เดิม
        const embed = new EmbedBuilder()
          .setTitle('🔄 Task Updated!')
          .setDescription(`Task **${updatedTask.name}** ได้รับการอัปเดทเป็น To Do โดย ${user.displayName || user.username}`)
          .setColor(0x0099ff)
          .setTimestamp()
        
        await interaction.message.edit({ embeds: [embed], components: [] })
      } else {
        await interaction.editReply({
          content: '❌ ไม่สามารถอัปเดท task status ได้ กรุณาลองใหม่'
        })
      }
      
    } else if (action === 'ignore') {
      // ไม่ทำอะไร แค่ซ่อน message
      await interaction.editReply({
        content: '👍 Ignored task match'
      })
      
      // ลบ embed เดิม
      await interaction.message.delete()
    }
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการจัดการ button interaction:', error)
    
    if (interaction.deferred) {
      await interaction.editReply({
        content: '❌ เกิดข้อผิดพลาดในการอัปเดท task กรุณาลองใหม่'
      })
    } else {
      await interaction.reply({
        content: '❌ เกิดข้อผิดพลาดในการอัปเดท task กรุณาลองใหม่',
        ephemeral: true
      })
    }
  }
})

client.login(process.env.DISCORD_TOKEN)
