import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface UserMappingConfig {
  filePath: string
}

export class UserMappingService {
  private userMapping: Record<string, string> = {} // Discord ID → ClickUp email mapping
  private config: UserMappingConfig

  constructor(config: UserMappingConfig) {
    this.config = config
    this.loadUserMapping()
  }

  /**
   * โหลด user mapping จากไฟล์
   */
  private loadUserMapping(): void {
    try {
      if (existsSync(this.config.filePath)) {
        const mappingData = readFileSync(this.config.filePath, 'utf8')
        this.userMapping = JSON.parse(mappingData)
        console.log(`📋 โหลด user mapping: ${Object.keys(this.userMapping).length} users`)
      } else {
        console.log('📋 ไม่พบ user mapping file สร้างไฟล์ใหม่')
        this.userMapping = {}
        this.saveUserMapping()
      }
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการโหลด user mapping:', error)
      this.userMapping = {}
    }
  }

  /**
   * บันทึก user mapping ลงไฟล์
   */
  private saveUserMapping(): void {
    try {
      writeFileSync(this.config.filePath, JSON.stringify(this.userMapping, null, 2), 'utf8')
      console.log('💾 บันทึก user mapping')
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการบันทึก user mapping:', error)
    }
  }

  /**
   * ได้รับ email จาก Discord user ID
   */
  public getEmailByUserId(userId: string): string | null {
    return this.userMapping[userId] || null
  }

  /**
   * ได้รับ Discord user ID จาก email
   */
  public getUserIdByEmail(email: string): string | null {
    for (const [userId, userEmail] of Object.entries(this.userMapping)) {
      if (userEmail === email) {
        return userId
      }
    }
    return null
  }

  /**
   * เพิ่ม/อัปเดต user mapping
   */
  public setUserMapping(userId: string, email: string): void {
    this.userMapping[userId] = email
    this.saveUserMapping()
    console.log(`📋 เพิ่ม/อัปเดต user mapping: ${userId} → ${email}`)
  }

  /**
   * ได้รับ user mapping ทั้งหมด
   */
  public getAllMappings(): Record<string, string> {
    return { ...this.userMapping }
  }

  /**
   * ตรวจสอบว่า user ID มี mapping หรือไม่
   */
  public hasMapping(userId: string): boolean {
    return userId in this.userMapping
  }

  /**
   * ได้รับจำนวน users ที่มี mapping
   */
  public getMappingCount(): number {
    return Object.keys(this.userMapping).length
  }

  /**
   * ได้รับรายการ Discord user IDs ที่มี mapping
   */
  public getMappedUserIds(): string[] {
    return Object.keys(this.userMapping)
  }
}