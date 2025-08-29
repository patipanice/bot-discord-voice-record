import axios from 'axios'
import { readFileSync, writeFileSync, unlinkSync } from 'fs'
import { TranscriptionResult } from './transcriber'

// ใส่ URL จาก ngrok ที่ได้จาก Colab
const COLAB_API_URL = 'https://90bd86dcc563.ngrok-free.app' // ✅ URL จริงจาก ngrok

// ฟังก์ชันตรวจสอบขนาดไฟล์
function getAudioFileSize(audioBuffer: Buffer): number {
    return audioBuffer.length
}

// ฟังก์ชันคำนวณ timeout ตามขนาดไฟล์
function calculateTimeout(fileSize: number): number {
    // ไฟล์ขนาดเล็ก (< 1MB): 30 วินาที
    if (fileSize < 1024 * 1024) {
        return 30000
    }
    // ไฟล์ขนาดกลาง (1-10MB): 2 นาที
    else if (fileSize < 10 * 1024 * 1024) {
        return 120000
    }
    // ไฟล์ขนาดใหญ่ (> 10MB): 5 นาที
    else {
        return 300000
    }
}

export async function transcribeAudioWithColab(audioBuffer: Buffer, userId: string): Promise<TranscriptionResult | null> {
    try {
        // ตรวจสอบขนาดไฟล์ก่อนส่ง
        const fileSize = getAudioFileSize(audioBuffer)
        console.log(`📁 ขนาดไฟล์เสียง: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`)
        
        // ข้ามการส่งถ้าไฟล์ว่างเปล่า
        if (fileSize === 0) {
            console.log(`⚠️ ข้ามการส่งไฟล์ว่างเปล่าไปยัง Colab API`)
            return null
        }
        
        // ข้ามการส่งถ้าไฟล์เล็กเกินไป
        if (fileSize < 1024) {
            console.log(`⚠️ ข้ามการส่งไฟล์เล็กเกินไปไปยัง Colab API (${fileSize} bytes)`)
            return null
        }
        
        console.log(`🚀 ส่งไฟล์เสียงไป Colab API...`)
        
        // แปลง Buffer เป็น base64
        const audioBase64 = audioBuffer.toString('base64')
        
        // คำนวณ timeout ตามขนาดไฟล์
        const timeout = calculateTimeout(fileSize)
        console.log(`⏱️ ตั้ง timeout: ${timeout}ms`)
        
        // ส่งไป Colab API
        const response = await axios.post(`${COLAB_API_URL}/transcribe`, {
            audio: audioBase64,
            user_id: userId
        }, {
            timeout: timeout,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        })
        
        if (response.data && response.data.transcript) {
            console.log(`✅ ได้ผลลัพธ์จาก Colab: ${response.data.transcript}`)
            return {
                userId,
                transcript: response.data.transcript,
                confidence: response.data.confidence || 0.95,
                timestamp: new Date().toISOString(),
                language: 'th',
                segments: response.data.segments || []
            }
        } else {
            console.log(`⚠️ Colab API ไม่ได้ส่งผลลัพธ์กลับมา`)
            return null
        }
    } catch (error: any) {
        if (error.response) {
            // Server error (500, 400, etc.)
            console.error(`❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Colab API: ${error.message}`)
            console.error(`📊 Status: ${error.response.status}`)
            console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
        } else if (error.request) {
            // Network error (timeout, connection refused, etc.)
            console.error(`❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Colab API: ${error.message}`)
        } else {
            // Other error
            console.error(`❌ เกิดข้อผิดพลาดในการเชื่อมต่อ Colab API: ${error.message}`)
        }
        return null
    }
}

// ฟังก์ชันเดิม (local fallback)
async function transcribeAudioLocal(audioBuffer: Buffer, userId: string): Promise<TranscriptionResult | null> {
    // ตรวจสอบว่าไฟล์ไม่ว่างเปล่า
    if (audioBuffer.length === 0) {
        console.log('⚠️ ไฟล์เสียงว่างเปล่า ข้ามการแปลงเสียง')
        return null
    }
    
    // ใช้ local Whisper
    const { transcribeAudio } = await import('./transcriber')
    
    // บันทึกไฟล์ชั่วคราว
    const tempFile = `recordings/temp_${userId}-${Date.now()}.wav`
    writeFileSync(tempFile, audioBuffer)
    
    try {
        const result = await transcribeAudio(tempFile, userId)
        // ลบไฟล์ชั่วคราว
        unlinkSync(tempFile)
        return result
    } catch (error) {
        console.error('❌ Local Whisper error:', error)
        return null
    }
}

// ฟังก์ชันตรวจสอบสถานะ API
export async function checkColabAPIHealth(): Promise<boolean> {
    try {
        const response = await axios.get(`${COLAB_API_URL}/health`, {
            timeout: 10000 // เพิ่ม timeout เป็น 10 วินาที
        })
        
        const data = response.data
        console.log(`🔍 Colab API Status: ${data.status}`)
        console.log(`🎯 Model: ${data.model}`)
        console.log(`⚡ Device: ${data.device}`)
        console.log(`🎯 WER: ${data.wer}%`)
        
        return data.status === 'healthy'
    } catch (error) {
        console.error('❌ Colab API ไม่ตอบสนอง:', error)
        return false
    }
}

// ฟังก์ชัน retry mechanism ที่ดีขึ้น
export async function transcribeWithRetry(audioBuffer: Buffer, userId: string, maxRetries = 3): Promise<TranscriptionResult | null> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`🔄 ลองครั้งที่ ${i + 1}/${maxRetries}...`)
            return await transcribeAudioWithColab(audioBuffer, userId)
        } catch (error) {
            console.log(`⚠️ ลองครั้งที่ ${i + 1}/${maxRetries} ไม่สำเร็จ: ${error}`)
            if (i === maxRetries - 1) {
                console.log('🔄 ใช้ local Whisper แทน')
                return await transcribeAudioLocal(audioBuffer, userId)
            }
            // รอก่อนลองใหม่ (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, i), 10000) // สูงสุด 10 วินาที
            console.log(`⏳ รอ ${delay}ms ก่อนลองใหม่...`)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }
    
    return null
} 