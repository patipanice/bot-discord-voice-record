import { createReadStream, createWriteStream, statSync, existsSync } from 'fs'
import { pipeline } from 'stream/promises'
import wav from 'wav'

export async function convertPcmToWav(pcmFilePath: string, wavFilePath: string): Promise<void> {
  try {
    // ตรวจสอบว่าไฟล์ PCM มีอยู่จริง
    if (!existsSync(pcmFilePath)) {
      throw new Error(`ไฟล์ PCM ไม่พบ: ${pcmFilePath}`)
    }

    // ตรวจสอบขนาดไฟล์ PCM
    const pcmStats = statSync(pcmFilePath)
    if (pcmStats.size === 0) {
      throw new Error(`ไฟล์ PCM ว่างเปล่า: ${pcmFilePath}`)
    }

    console.log(`📁 ขนาดไฟล์ PCM: ${pcmStats.size} bytes`)

    // ตรวจสอบว่าขนาดไฟล์มีขนาดที่เหมาะสม (อย่างน้อย 1KB)
    if (pcmStats.size < 1024) {
      console.log(`⚠️ ไฟล์ PCM มีขนาดเล็กเกินไป: ${pcmStats.size} bytes`)
    }

    const reader = createReadStream(pcmFilePath)
    const writer = new wav.FileWriter(wavFilePath, {
      channels: 2,
      sampleRate: 48000,
      bitDepth: 16
    })

    await pipeline(reader, writer)
    
    // ตรวจสอบไฟล์ WAV ที่สร้างขึ้น
    if (existsSync(wavFilePath)) {
      const wavStats = statSync(wavFilePath)
      console.log(`✅ แปลงไฟล์สำเร็จ: ${pcmFilePath} → ${wavFilePath} (${wavStats.size} bytes)`)
      
      // ตรวจสอบว่าขนาดไฟล์ WAV มีขนาดที่เหมาะสม
      if (wavStats.size < 1024) {
        console.log(`⚠️ ไฟล์ WAV มีขนาดเล็กเกินไป: ${wavStats.size} bytes`)
      }
    } else {
      throw new Error(`ไม่สามารถสร้างไฟล์ WAV ได้: ${wavFilePath}`)
    }
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการแปลงไฟล์: ${error}`)
    throw error
  }
} 