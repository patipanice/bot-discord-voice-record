// ทดสอบ ClickUp API connection
const axios = require('axios');
require('dotenv').config();

async function testClickUpAPI() {
  console.log('🔍 ทดสอบ ClickUp API...\n');
  
  const apiToken = process.env.CLICKUP_API_TOKEN;
  const teamId = process.env.CLICKUP_TEAM_ID;
  
  console.log(`🔑 API Token: ${apiToken ? apiToken.substring(0, 20) + '...' : 'ไม่พบ'}`);
  console.log(`🏢 Team ID: ${teamId || 'ไม่พบ'}\n`);
  
  if (!apiToken || !teamId) {
    console.error('❌ ไม่พบ CLICKUP_API_TOKEN หรือ CLICKUP_TEAM_ID ใน .env file');
    return;
  }

  const client = axios.create({
    baseURL: 'https://api.clickup.com/api/v2',
    headers: {
      'Authorization': apiToken,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  try {
    // Test 1: ทดสอบ authentication
    console.log('📋 Test 1: ทดสอบ authentication...');
    const userResponse = await client.get('/user');
    
    console.log(`✅ Authentication สำเร็จ: ${userResponse.data.user.username}`);
    console.log(`📧 Email: ${userResponse.data.user.email}\n`);

    // Test 2: ทดสอบ team access
    console.log('🏢 Test 2: ทดสอบ team access...');
    const teamResponse = await client.get('/team');

    const teams = teamResponse.data.teams;
    const targetTeam = teams.find(team => team.id === teamId);
    
    if (targetTeam) {
      console.log(`✅ พบ team: ${targetTeam.name}`);
      console.log(`👥 จำนวนสมาชิก: ${targetTeam.members?.length || 0} คน\n`);
    } else {
      console.error(`❌ ไม่พบ team ID: ${teamId}`);
      console.log('📋 Teams ที่เข้าถึงได้:');
      teams.forEach(team => {
        console.log(`   - ${team.name} (ID: ${team.id})`);
      });
      return;
    }

    // Test 3: ทดสอบการดึง spaces
    console.log('📁 Test 3: ทดสอบการดึง spaces...');
    const spacesResponse = await client.get(`/team/${teamId}/space`);

    const spaces = spacesResponse.data.spaces;
    console.log(`✅ พบ ${spaces.length} spaces:`);
    spaces.forEach((space, index) => {
      console.log(`   ${index + 1}. ${space.name} (ID: ${space.id})`);
    });

    // Test 4: ทดสอบการค้นหา tasks
    console.log('\n📝 Test 4: ทดสอบการค้นหา tasks...');
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
    console.log(`✅ พบ ${tasks.length} tasks:`);
    
    if (tasks.length > 0) {
      console.log('\n📋 ตัวอย่าง tasks:');
      tasks.slice(0, 5).forEach((task, index) => {
        console.log(`   ${index + 1}. ${task.name}`);
        console.log(`      สถานะ: ${task.status.status}`);
        console.log(`      Assignees: ${task.assignees.map(a => a.username).join(', ') || 'ไม่มี'}`);
        console.log(`      URL: ${task.url}\n`);
      });
    }

    console.log('🎉 ทดสอบ ClickUp API สำเร็จทั้งหมด!');
    console.log('✅ พร้อมใช้งาน Discord bot integration แล้ว');

    return {
      success: true,
      user: userResponse.data.user,
      team: targetTeam,
      spaces,
      tasks
    };

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📄 Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return { success: false, error: error.message };
  }
}

// เรียกใช้ฟังก์ชัน
if (require.main === module) {
  testClickUpAPI();
}

module.exports = { testClickUpAPI };