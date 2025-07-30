require('dotenv').config();
const axios = require('axios');

async function debugStatuses() {
  const client = axios.create({
    baseURL: 'https://api.clickup.com/api/v2',
    headers: {
      'Authorization': process.env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  try {
    console.log('🔍 Debug: ตรวจสอบ statuses ที่ใช้ได้...\n');
    
    const teamId = process.env.CLICKUP_TEAM_ID;
    
    // ดึง tasks ก่อน
    const tasksResponse = await client.get(`/team/${teamId}/task`, {
      params: {
        page: 0,
        order_by: 'updated',
        reverse: true,
        subtasks: true,
        include_closed: false
      }
    });
    
    const tasks = tasksResponse.data.tasks;
    if (tasks.length === 0) {
      console.log('❌ ไม่พบ tasks');
      return;
    }
    
    const firstTask = tasks[0];
    console.log(`📋 ใช้ task: ${firstTask.name} (${firstTask.id})`);
    console.log(`📍 List ID: ${firstTask.list.id}`);
    console.log(`🏢 Space ID: ${firstTask.space.id}`);
    
    // ดึงข้อมูล list เพื่อดู statuses
    console.log('\n🔍 ดึงข้อมูล list statuses...');
    const listResponse = await client.get(`/list/${firstTask.list.id}`);
    
    console.log('\n📊 Available Statuses:');
    const statuses = listResponse.data.statuses || [];
    statuses.forEach((status, index) => {
      console.log(`   ${index + 1}. "${status.status}" (${status.type})`);
      console.log(`      Color: ${status.color}`);
      console.log(`      Order: ${status.orderindex}`);
    });
    
    console.log('\n🎯 Current Task Status:');
    console.log(`   Status: "${firstTask.status.status}"`);
    console.log(`   Type: ${firstTask.status.type || 'N/A'}`);
    console.log(`   Color: ${firstTask.status.color}`);
    
    // ทดสอบอัปเดทด้วย status ที่มีจริง
    if (statuses.length > 1) {
      const targetStatus = statuses.find(s => s.type === 'progress') || statuses[1];
      console.log(`\n🧪 ทดสอบอัปเดทเป็น: "${targetStatus.status}"`);
      
      try {
        const updateResponse = await client.put(`/task/${firstTask.id}`, {
          status: targetStatus.status
        });
        console.log(`✅ อัปเดทสำเร็จ: ${updateResponse.data.name}`);
        console.log(`📊 Status ใหม่: ${updateResponse.data.status.status}`);
        
        // กลับไปเป็น status เดิม
        setTimeout(async () => {
          try {
            await client.put(`/task/${firstTask.id}`, {
              status: firstTask.status.status
            });
            console.log(`🔄 กลับเป็น status เดิม: ${firstTask.status.status}`);
          } catch (error) {
            console.log('⚠️ ไม่สามารถกลับ status เดิมได้');
          }
        }, 2000);
        
      } catch (updateError) {
        console.error('❌ ไม่สามารถอัปเดท task ได้:', updateError.response?.data || updateError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📄 Response:`, error.response.data);
    }
  }
}

debugStatuses();