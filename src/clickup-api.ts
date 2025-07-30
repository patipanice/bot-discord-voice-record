import axios, { AxiosInstance, AxiosResponse } from 'axios'
import * as dotenv from 'dotenv'

// โหลด environment variables
dotenv.config()

// Environment Variables ที่จำเป็น:
// CLICKUP_API_TOKEN=your_personal_access_token
// CLICKUP_TEAM_ID=your_team_id (optional)

interface ClickUpConfig {
  apiToken: string
  teamId?: string
  baseUrl: string
}

export interface ClickUpTask {
  id: string
  name: string
  description?: string
  status: {
    id: string
    status: string
    color: string
  }
  assignees: Array<{
    id: string
    username: string
    email: string
  }>
  creator: {
    id: string
    username: string
    email: string
  }
  date_created: string
  date_updated: string
  url: string
  list: {
    id: string
    name: string
  }
  folder: {
    id: string
    name: string
  }
  space: {
    id: string
    name: string
  }
}

export interface ClickUpUser {
  id: string
  username: string
  email: string
  color: string
  profilePicture?: string
}

export interface ClickUpTeamMember {
  user: ClickUpUser
  invited_by?: {
    id: string
    username: string
    email: string
    color: string
    initials: string
    profilePicture?: string
    banned_date?: string
    status: string
  }
}

export interface ClickUpTaskSearchResponse {
  tasks: ClickUpTask[]
  last_page: boolean
}

export interface ClickUpTaskSearchOptions {
  page?: number
  order_by?: string
  reverse?: boolean
  subtasks?: boolean
  include_closed?: boolean
  statuses?: string[]
}

export interface ClickUpTeamResponse {
  teams: Array<{
    id: string
    name: string
    color: string
    avatar?: string
    members: ClickUpTeamMember[]
  }>
}

export interface ClickUpList {
  id: string
  name: string
  orderindex: number
  status?: {
    status: string
    color: string
  }
  priority?: {
    priority: string
    color: string
  }
  assignee?: ClickUpUser
  task_count?: number
  due_date?: string
  start_date?: string
  folder: {
    id: string
    name: string
    hidden: boolean
  }
  space: {
    id: string
    name: string
  }
  archived: boolean
}

export interface ClickUpCreateTaskRequest {
  name: string
  description?: string
  assignees?: string[]
  tags?: string[]
  status?: string
  priority?: number
  due_date?: number
  start_date?: number
  notify_all?: boolean
}

class ClickUpAPI {
  private client: AxiosInstance
  private config: ClickUpConfig

  constructor() {
    this.config = {
      apiToken: process.env.CLICKUP_API_TOKEN || '',
      teamId: process.env.CLICKUP_TEAM_ID,
      baseUrl: 'https://api.clickup.com/api/v2'
    }

    if (!this.config.apiToken) {
      throw new Error('❌ ไม่พบ CLICKUP_API_TOKEN ใน environment variables')
    }

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': this.config.apiToken,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    })

    console.log('✅ ClickUp API client initialized')
  }

  /**
   * ค้นหา tasks ทั้งหมดในทีม
   */
  async searchAllTeamTasks(options: ClickUpTaskSearchOptions = {}): Promise<ClickUpTask[]> {
    try {
      console.log(`📋 ค้นหา tasks ทั้งหมดในทีม`)

      const teamId = this.config.teamId
      if (!teamId) {
        throw new Error('❌ ไม่พบ CLICKUP_TEAM_ID ใน environment variables')
      }

      const queryParams: any = {
        page: options.page || 0,
        order_by: options.order_by || 'updated',
        reverse: options.reverse !== undefined ? options.reverse : true,
        subtasks: options.subtasks !== undefined ? options.subtasks : true,
        include_closed: options.include_closed !== undefined ? options.include_closed : false
      }

      const response: AxiosResponse<ClickUpTaskSearchResponse> = await this.client.get(
        `/team/${teamId}/task`,
        { params: queryParams }
      )

      const tasks = response.data.tasks || []
      console.log(`✅ พบ ${tasks.length} tasks ในทีม`)
      return tasks
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการค้นหา tasks ทั้งหมด:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * ค้นหา tasks ของ user ที่ assign หรือสร้างโดย user
   */
  async searchUserTasks(
    userId: string,
    options: {
      assignees?: string[]
      statuses?: string[]
      include_closed?: boolean
      page?: number
      order_by?: string
      reverse?: boolean
    } = {}
  ): Promise<ClickUpTask[]> {
    try {
      console.log(`🔍 ค้นหา tasks ของ user: ${userId}`)

      const params: any = {
        assignees: options.assignees || [userId],
        include_closed: options.include_closed || false,
        page: options.page || 0,
        order_by: options.order_by || 'updated',
        reverse: options.reverse || true
      }

      if (options.statuses && options.statuses.length > 0) {
        params.statuses = options.statuses
      }

      // ค้นหาจากทุก workspace ของ team
      const teamId = this.config.teamId
      if (!teamId) {
        throw new Error('❌ ไม่พบ CLICKUP_TEAM_ID ใน environment variables')
      }

      const response: AxiosResponse<ClickUpTaskSearchResponse> = await this.client.get(
        `/team/${teamId}/task`,
        { params }
      )

      const tasks = response.data.tasks || []
      console.log(`✅ พบ ${tasks.length} tasks สำหรับ user: ${userId}`)

      return tasks
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการค้นหา tasks:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * อัปเดทสถานะของ task
   */
  async updateTaskStatus(taskId: string, status: string): Promise<ClickUpTask> {
    try {
      console.log(`🔄 อัปเดทสถานะ task ${taskId} เป็น: ${status}`)

      const response: AxiosResponse<ClickUpTask> = await this.client.put(
        `/task/${taskId}`,
        {
          status: status
        }
      )

      console.log(`✅ อัปเดทสถานะ task สำเร็จ: ${response.data.name}`)
      return response.data
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการอัปเดทสถานะ task:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * ดึงรายละเอียดของ task
   */
  async getTaskDetails(taskId: string): Promise<ClickUpTask> {
    try {
      console.log(`📋 ดึงรายละเอียด task: ${taskId}`)

      const response: AxiosResponse<ClickUpTask> = await this.client.get(`/task/${taskId}`)

      console.log(`✅ ดึงรายละเอียด task สำเร็จ: ${response.data.name}`)
      return response.data
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการดึงรายละเอียด task:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * หา ClickUp user จาก email หรือ username
   */
  async getUserFromEmail(email: string): Promise<ClickUpTeamMember | null> {
    try {
      console.log(`👤 ค้นหา ClickUp user จาก email: ${email}`)

      const teamId = this.config.teamId
      if (!teamId) {
        throw new Error('❌ ไม่พบ CLICKUP_TEAM_ID ใน environment variables')
      }

      const response: AxiosResponse<ClickUpTeamResponse> = await this.client.get(
        `/team`
      )

      // ค้นหา user ในทุก team
      for (const team of response.data.teams) {
        if (team.id === teamId) {
          const user = team.members.find(member => 
            (member.user?.email && member.user.email.toLowerCase() === email.toLowerCase()) ||
            (member.user?.username && member.user.username.toLowerCase() === email.toLowerCase())
          )
          
          if (user) {
            console.log(`✅ พบ ClickUp user: ${user.user.username} (${user.user.email})`)
            return user
          }
        }
      }

      console.log(`⚠️ ไม่พบ ClickUp user สำหรับ email: ${email}`)
      return null
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการค้นหา user:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      return null
    }
  }

  /**
   * ดึงรายการ status ที่เป็นไปได้สำหรับ list หรือ space
   */
  async getAvailableStatuses(listId?: string, spaceId?: string): Promise<Array<{id: string, status: string, color: string}>> {
    try {
      let endpoint = ''
      
      if (listId) {
        endpoint = `/list/${listId}`
        console.log(`📊 ดึง statuses จาก list: ${listId}`)
      } else if (spaceId) {
        endpoint = `/space/${spaceId}`
        console.log(`📊 ดึง statuses จาก space: ${spaceId}`)
      } else {
        throw new Error('❌ ต้องระบุ listId หรือ spaceId')
      }

      const response = await this.client.get(endpoint)
      const statuses = response.data.statuses || []

      console.log(`✅ พบ ${statuses.length} statuses`)
      return statuses
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการดึง statuses:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * ดึงรายการ Lists จาก Space
   */
  async getSpaceLists(spaceId: string): Promise<ClickUpList[]> {
    try {
      console.log(`📁 ดึงรายการ Lists จาก Space: ${spaceId}`)

      const response: AxiosResponse<{ lists: ClickUpList[] }> = await this.client.get(
        `/space/${spaceId}/list`
      )

      const lists = response.data.lists || []
      console.log(`✅ พบ ${lists.length} lists`)
      return lists
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการดึง Lists:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * สร้าง Task ใหม่ใน List
   */
  async createTask(listId: string, taskData: ClickUpCreateTaskRequest): Promise<ClickUpTask> {
    try {
      console.log(`📝 สร้าง Task ใหม่: ${taskData.name}`)

      const response: AxiosResponse<ClickUpTask> = await this.client.post(
        `/list/${listId}/task`,
        taskData
      )

      console.log(`✅ สร้าง Task สำเร็จ: ${response.data.name} (ID: ${response.data.id})`)
      return response.data
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการสร้าง Task:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * Assign User ให้ Task
   */
  async assignUserToTask(taskId: string, userId: string, operation: 'add' | 'rem' = 'add'): Promise<void> {
    try {
      console.log(`👤 ${operation === 'add' ? 'เพิ่ม' : 'ลบ'} User assignment: Task ${taskId}`)

      await this.client.put(`/task/${taskId}/assignee/${userId}`, {
        operation: operation
      })

      console.log(`✅ ${operation === 'add' ? 'เพิ่ม' : 'ลบ'} User assignment สำเร็จ`)
    } catch (error: any) {
      console.error('❌ เกิดข้อผิดพลาดในการ assign User:', error.message)
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`)
        console.error(`📄 Response: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  /**
   * ตรวจสอบการเชื่อมต่อ ClickUp API
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 ทดสอบการเชื่อมต่อ ClickUp API...')
      
      const response = await this.client.get('/user')
      console.log(`✅ เชื่อมต่อ ClickUp API สำเร็จ: ${response.data.user.username}`)
      return true
    } catch (error: any) {
      console.error('❌ ไม่สามารถเชื่อมต่อ ClickUp API:', error.message)
      return false
    }
  }
}

// Export singleton instance
export const clickUpAPI = new ClickUpAPI()

// Export utility functions
export async function searchAllTeamTasks(
  options: {
    statuses?: string[]
    include_closed?: boolean
  } = {}
): Promise<ClickUpTask[]> {
  return await clickUpAPI.searchAllTeamTasks(options)
}

export async function searchUserTasksByEmail(
  email: string,
  options: {
    statuses?: string[]
    include_closed?: boolean
  } = {}
): Promise<ClickUpTask[]> {
  const user = await clickUpAPI.getUserFromEmail(email)
  if (!user) {
    return []
  }

  return await clickUpAPI.searchUserTasks(user.user.id, options)
}

export async function updateTaskStatusById(taskId: string, status: string): Promise<ClickUpTask | null> {
  try {
    return await clickUpAPI.updateTaskStatus(taskId, status)
  } catch (error) {
    console.error('❌ ไม่สามารถอัปเดท task status:', error)
    return null
  }
}

export async function getTaskById(taskId: string): Promise<ClickUpTask | null> {
  try {
    return await clickUpAPI.getTaskDetails(taskId)
  } catch (error) {
    console.error('❌ ไม่สามารถดึงรายละเอียด task:', error)
    return null
  }
}