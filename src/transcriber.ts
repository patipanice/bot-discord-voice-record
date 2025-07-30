import { spawn } from 'child_process'
import { convertPcmToWav } from './converter'
import { readFileSync, existsSync, statSync } from 'fs'

export interface TranscriptionResult {
  userId: string
  transcript: string
  confidence: number
  timestamp: string
  language: string
  segments: Array<{
    start: number
    end: number
    text: string
    avg_logprob: number
  }>
}

// ฟังก์ชันตรวจสอบไฟล์เสียง
function validateAudioFile(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) {
      console.log(`❌ ไฟล์ไม่พบ: ${filePath}`)
      return false
    }
    
    const stats = statSync(filePath)
    if (stats.size === 0) {
      console.log(`⚠️ ไฟล์เสียงว่างเปล่า: ${filePath}`)
      return false
    }
    
    // ตรวจสอบว่าขนาดไฟล์มีขนาดที่เหมาะสม (อย่างน้อย 1KB)
    if (stats.size < 1024) {
      console.log(`⚠️ ไฟล์เสียงมีขนาดเล็กเกินไป: ${filePath} (${stats.size} bytes)`)
      return false
    }
    
    console.log(`✅ ไฟล์เสียงผ่านการตรวจสอบ: ${filePath} (${stats.size} bytes)`)
    return true
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการตรวจสอบไฟล์: ${error}`)
    return false
  }
}

export async function transcribeAudio(pcmFilePath: string, userId: string): Promise<TranscriptionResult | null> {
  try {
    console.log(`🔄 แปลงไฟล์ PCM เป็น WAV...`)
    const wavFilePath = pcmFilePath.replace('.pcm', '.wav')
    await convertPcmToWav(pcmFilePath, wavFilePath)
    
    // ตรวจสอบไฟล์ WAV หลังแปลง
    if (!validateAudioFile(wavFilePath)) {
      console.log(`❌ ไฟล์ WAV ไม่ผ่านการตรวจสอบ: ${wavFilePath}`)
      return null
    }
    
    console.log(`🎯 เรียกใช้ Whisper สำหรับไฟล์ ${wavFilePath}...`)
    const result = await runWhisperWithRetry(wavFilePath, 3)
    
    if (result && result.transcript && result.transcript.trim()) {
      return {
        userId,
        transcript: result.transcript.trim(),
        confidence: result.confidence || 0.95,
        timestamp: new Date().toISOString(),
        language: 'th',
        segments: result.segments || []
      }
    } else {
      console.log(`⚠️ Whisper ไม่ได้ข้อความ (อาจเป็นเสียงเงียบ)`)
      return null
    }
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการแปลงเสียง: ${error}`)
    return null
  }
}

async function runWhisperWithRetry(wavFilePath: string, maxRetries: number): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🐍 เริ่ม Python Whisper script (ครั้งที่ ${attempt}/${maxRetries})...`)
      
      return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['whisper_transcribe.py', wavFilePath])
        
        let stdout = ''
        let stderr = ''
        
        pythonProcess.stdout.on('data', (data) => {
          stdout += data.toString()
        })
        
        pythonProcess.stderr.on('data', (data) => {
          stderr += data.toString()
        })
        
        pythonProcess.on('close', (code) => {
          console.log(`🐍 Python Whisper เสร็จสิ้น (exit code: ${code})`)
          
          if (code === 0) {
            try {
              const result = JSON.parse(stdout)
              resolve(result)
            } catch (parseError) {
              console.error(`❌ ไม่สามารถ parse ผลลัพธ์ได้: ${parseError}`)
              reject(new Error(`Whisper failed with code ${code}: ${stderr}`))
            }
          } else {
            console.error(`❌ Whisper failed: ${stderr}`)
            reject(new Error(`Whisper failed with code ${code}: ${stderr}`))
          }
        })
        
        pythonProcess.on('error', (error) => {
          console.error(`❌ เกิดข้อผิดพลาดในการเรียก Python: ${error}`)
          reject(error)
        })
      })
    } catch (error) {
      console.error(`❌ Whisper ครั้งที่ ${attempt} ไม่สำเร็จ: ${error}`)
      
      if (attempt < maxRetries) {
        const delay = attempt * 1000 // เพิ่ม delay ตามจำนวนครั้งที่ลอง
        console.log(`⏳ รอ ${delay}ms ก่อนลองใหม่...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        console.error(`❌ Whisper ล้มเหลวทั้งหมด ${maxRetries} ครั้ง`)
        throw error
      }
    }
  }
  
  return null
} 