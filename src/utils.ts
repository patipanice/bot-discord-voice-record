import { Readable } from 'stream'
import prism from 'prism-media'
import { createWriteStream, writeFileSync, appendFileSync, readFileSync, unlinkSync } from 'fs'
import { transcribeAudio, TranscriptionResult } from './transcriber'
import { addSessionTranscript, incrementPendingTranscriptions, decrementPendingTranscriptions } from './bot'
import { transcribeAudioWithColab, checkColabAPIHealth } from './colab-api'
import { convertPcmToWav } from './converter'

export function saveUserAudioStream(userId: string, stream: Readable) {
  const decoder = new prism.opus.Decoder({
    frameSize: 960,
    channels: 2,
    rate: 48000
  })

  const filename = `recordings/${userId}-${Date.now()}.pcm`
  const output = createWriteStream(filename)

  console.log(`🎤 เริ่มบันทึกเสียงของ ${userId}...`)
  stream.pipe(decoder).pipe(output)

  output.on('finish', async () => {
    console.log(`💾 บันทึกไฟล์เสียงของ ${userId} ที่ ${filename}`)
    console.log(`🔄 แปลงไฟล์ PCM เป็น WAV...`)

    incrementPendingTranscriptions()

    try {
      // แปลง PCM เป็น WAV
      const wavFilename = filename.replace('.pcm', '.wav')
      await convertPcmToWav(filename, wavFilename)
      console.log(`✅ แปลงไฟล์ WAV สำเร็จ: ${wavFilename}`)
      
      // อ่านไฟล์ WAV
      const audioBuffer = readFileSync(wavFilename)
      
      // ตรวจสอบสถานะ Colab API
      const isColabAvailable = await checkColabAPIHealth()
      
      let result: TranscriptionResult | null = null
      
      if (isColabAvailable) {
        // ใช้ Colab API
        console.log(`🚀 ส่งไฟล์ WAV ไป Colab API...`)
        result = await transcribeAudioWithColab(audioBuffer, userId)
      } else {
        // ใช้ local Whisper
        console.log('🔄 ใช้ local Whisper แทน...')
        result = await transcribeAudio(wavFilename, userId)
      }
      
      if (result) {
        console.log(`✅ แปลงเสียงสำเร็จ! ข้อความ: "${result.transcript}"`)
        saveTranscription(result)
        await addSessionTranscript(result.userId, result.transcript, result.confidence)
      } else {
        console.log('❌ ไม่สามารถแปลงเสียงได้')
      }
      
      // ลบไฟล์ชั่วคราว
      try {
        unlinkSync(filename) // ลบไฟล์ PCM
        unlinkSync(wavFilename) // ลบไฟล์ WAV
        console.log(`🗑️ ลบไฟล์ชั่วคราวแล้ว`)
      } catch (unlinkError) {
        console.error('❌ เกิดข้อผิดพลาดในการลบไฟล์ชั่วคราว:', unlinkError)
      }
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการแปลงเสียง:', error)
    } finally {
      decrementPendingTranscriptions()
    }
  })
}

export function saveTranscription(result: TranscriptionResult) {
  const transcriptFile = `recordings/transcripts.txt`
  const line = `[${result.timestamp}] ${result.userId}: ${result.transcript} (ความแม่นยำ: ${(result.confidence * 100).toFixed(1)}%)\n`
  
  appendFileSync(transcriptFile, line, 'utf8')
  console.log(`📄 บันทึก transcript ลงใน ${transcriptFile}`)
}
