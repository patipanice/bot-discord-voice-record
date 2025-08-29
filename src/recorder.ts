import {
    joinVoiceChannel,
    EndBehaviorType,
    VoiceConnection
  } from '@discordjs/voice'
  import { VoiceChannel } from 'discord.js'
  import { createWriteStream } from 'fs'
  import prism from 'prism-media'
  import { saveUserAudioStream } from './utils'
  
  let currentConnection: VoiceConnection | null = null
  
  // Track active recordings to prevent duplicates  
  const activeRecordings = new Set<string>()
  
  export async function joinVoiceAndRecord(channel: VoiceChannel): Promise<VoiceConnection> {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator
    })
  
    currentConnection = connection
  
    const receiver = connection.receiver
  
    receiver.speaking.on('start', (userId) => {
      // ป้องกัน duplicate recordings
      if (activeRecordings.has(userId)) {
        console.log(`⚠️ ${userId} กำลังบันทึกอยู่แล้ว - ข้าม`)
        return
      }
      
      console.log(`🎤 ${userId} เริ่มพูด`)
      activeRecordings.add(userId)
  
      const audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1000
        }
      })
      
      // ลบออกจาก activeRecordings เมื่อ stream จบ
      audioStream.on('end', () => {
        activeRecordings.delete(userId)
        console.log(`🏁 ${userId} จบการบันทึก`)
      })
  
      saveUserAudioStream(userId, audioStream)
    })
  
    return connection
  }
  
  export function leaveVoiceChannel(): boolean {
    if (currentConnection) {
      currentConnection.destroy()
      currentConnection = null
      console.log('👋 ออกจากห้องเสียงแล้ว')
      return true
    }
    return false
  }
  