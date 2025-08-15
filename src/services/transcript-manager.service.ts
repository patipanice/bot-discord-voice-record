import { EmbedBuilder } from 'discord.js'
import { SessionTranscript } from '../types/transcript.types'
import { TranscriptValidationBLL } from '../bll/transcript-validation.bll'
import { SessionManagementBLL } from '../bll/session-management.bll'

export class TranscriptManagerService {
  private sessionTranscripts: SessionTranscript[] = []
  private isRecording: boolean = false
  private validationBLL: TranscriptValidationBLL
  private sessionBLL: SessionManagementBLL

  constructor() {
    this.validationBLL = new TranscriptValidationBLL()
    this.sessionBLL = new SessionManagementBLL()
  }

  /**
   * ตรวจสอบว่า transcript ผิดปกติหรือไม่ (ใช้ BLL)
   */
  public isInvalidTranscript(transcript: string): boolean {
    const result = this.validationBLL.validateTranscript(transcript)
    if (!result.isValid && result.reason) {
      console.log(`⚠️ FILTERED: ${result.reason}`)
    }
    return !result.isValid
  }

  /**
   * เพิ่ม transcript เข้า session (ใช้ BLL)
   */
  public addSessionTranscript(userId: string, transcript: string, confidence: number): boolean {
    console.log(`🔍 addSessionTranscript: isRecording = ${this.isRecording}`)
    console.log(`🔍 addSessionTranscript: transcript = "${transcript}"`)
    
    // ตรวจสอบ transcript ที่ผิดปกติก่อน
    if (this.isInvalidTranscript(transcript)) {
      console.log(`⚠️ ข้าม transcript ที่ผิดปกติ: "${transcript.substring(0, 50)}..."`)
      return false
    }
    
    // ใช้ BLL ตรวจสอบว่าควรเพิ่มหรือไม่
    const shouldAddResult = this.sessionBLL.shouldAddToSession(
      userId, transcript, this.isRecording, this.sessionTranscripts
    )
    
    if (shouldAddResult.shouldAdd) {
      this.sessionTranscripts.push({
        userId,
        transcript,
        confidence,
        timestamp: new Date().toISOString()
      })
      console.log(`📝 เพิ่ม transcript ในเซสชัน: "${transcript}" (${(confidence * 100).toFixed(1)}%)`)
      console.log(`📊 sessionTranscripts.length = ${this.sessionTranscripts.length}`)
      return true
    } else {
      console.log(`⚠️ ข้าม transcript: ${shouldAddResult.reason}`)
      return false
    }
  }

  /**
   * สร้าง basic embed สำหรับ transcript
   */
  public createBasicTranscriptEmbed(
    displayName: string, 
    transcript: string, 
    confidence: number,
    hasTaskMatch: boolean = false
  ): EmbedBuilder {
    const timestamp = new Date().toLocaleString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${displayName} • ${timestamp}`,
        iconURL: `https://cdn.discordapp.com/avatars/avatar.png` // Placeholder
      })
      .setDescription(`🎤 "${transcript}"`)
      .setColor(hasTaskMatch ? 0x007acc : 0x00ff00) // น้ำเงินถ้ามี task match, เขียวถ้าไม่มี
      .setTimestamp()

    // เพิ่ม confidence field
    embed.addFields({
      name: 'ความแม่นยำ',
      value: `${(confidence * 100).toFixed(1)}%`,
      inline: true
    })

    return embed
  }

  /**
   * จัดการสถานะการบันทึก
   */
  public setRecordingStatus(recording: boolean): void {
    this.isRecording = recording
    console.log(`📊 เปลี่ยนสถานะการบันทึก: ${recording}`)
  }

  /**
   * ได้รับ session transcripts
   */
  public getSessionTranscripts(): SessionTranscript[] {
    return [...this.sessionTranscripts]
  }

  /**
   * ล้าง session transcripts
   */
  public clearSessionTranscripts(): void {
    this.sessionTranscripts = []
    console.log(`🧹 ล้าง sessionTranscripts แล้ว`)
  }

  /**
   * ตรวจสอบสถานะการบันทึก
   */
  public getRecordingStatus(): boolean {
    return this.isRecording
  }

  /**
   * ได้รับจำนวน transcripts ใน session
   */
  public getSessionCount(): number {
    return this.sessionTranscripts.length
  }

  /**
   * จัดกลุ่ม transcripts ตาม userId (ใช้ BLL)
   */
  public groupTranscriptsByUser(): Map<string, SessionTranscript[]> {
    return this.sessionBLL.groupTranscriptsByUser(this.sessionTranscripts)
  }
  
  /**
   * สร้างข้อมูลสรุปการประชุม (ใช้ BLL)
   */
  public createSessionSummary(maxFields: number = 20) {
    return this.sessionBLL.createSessionSummary(this.sessionTranscripts, maxFields)
  }
}