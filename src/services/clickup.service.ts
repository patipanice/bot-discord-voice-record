import { searchAllTeamTasks, searchUserTasksByEmail, updateTaskStatusById } from '../clickup-api'
import { ClickUpIntegrationConfig, TaskActionResult } from '../types/clickup.types'

export class ClickUpService {
  private config: ClickUpIntegrationConfig

  constructor(config: ClickUpIntegrationConfig) {
    this.config = config
  }

  /**
   * ทดสอบการเชื่อมต่อ ClickUp API
   */
  public async testConnection(): Promise<boolean> {
    try {
      const clickUpModule = await import('../clickup-api')
      return await clickUpModule.clickUpAPI.testConnection()
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการทดสอบ ClickUp connection:', error)
      return false
    }
  }

  /**
   * โหลด tasks ของ user จาก ClickUp
   */
  public async loadUserTasks(email: string): Promise<Array<{id: string, name: string, description?: string, url: string}>> {
    try {
      console.log(`📋 โหลด tasks ของ user: ${email}`)
      
      const tasks = await searchUserTasksByEmail(email, {
        include_closed: false
      })
      
      const userTasks = tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        url: task.url
      }))
      
      console.log(`✅ โหลด ${userTasks.length} tasks`)
      return userTasks
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการโหลด tasks:', error)
      return []
    }
  }

  /**
   * โหลด tasks ทั้งหมดในทีม
   */
  public async loadAllTeamTasks(): Promise<Array<{id: string, name: string, description?: string, url: string}>> {
    try {
      console.log('📋 โหลด tasks ทั้งหมดในทีม')
      
      const tasks = await searchAllTeamTasks({
        include_closed: false
      })
      
      const teamTasks = tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        url: task.url
      }))
      
      console.log(`✅ โหลด ${teamTasks.length} team tasks`)
      return teamTasks
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการโหลด team tasks:', error)
      return []
    }
  }

  /**
   * อัปเดต task status
   */
  public async updateTaskStatus(taskId: string, status: string): Promise<TaskActionResult> {
    try {
      const updatedTask = await updateTaskStatusById(taskId, status)
      
      if (updatedTask) {
        const statusText = status === 'complete' ? 'Complete' : 'To Do'
        return {
          success: true,
          taskName: updatedTask.name,
          message: `✅ **${updatedTask.name}** ถูกอัปเดทเป็น **${statusText}** แล้ว!`
        }
      }
      
      return {
        success: false,
        message: '❌ ไม่สามารถอัปเดท task status ได้ กรุณาลองใหม่'
      }
      
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดในการอัปเดท task:', error)
      return {
        success: false,
        message: '❌ เกิดข้อผิดพลาดในการอัปเดท task กรุณาลองใหม่'
      }
    }
  }

  /**
   * อัปเดตการตั้งค่า
   */
  public updateConfig(config: Partial<ClickUpIntegrationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * ตรวจสอบสถานะการทำงาน
   */
  public isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * ได้รับจำนวน tasks ที่มี
   */
  public getTaskCount(): number {
    return this.config.tasks.length
  }

  /**
   * ได้รับ tasks ทั้งหมด
   */
  public getTasks(): Array<{id: string, name: string, description?: string, url: string}> {
    return this.config.tasks
  }
}