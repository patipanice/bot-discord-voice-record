// สร้าง user-mapping.json โดยดึงข้อมูล Team Members จาก ClickUp
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

async function getTeamMembers() {
  console.log('👥 ดึงข้อมูล Team Members จาก ClickUp...\n');
  
  const apiToken = process.env.CLICKUP_API_TOKEN;
  const teamId = process.env.CLICKUP_TEAM_ID;
  
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
    // Method 1: ลองดึงจาก /team endpoint
    console.log('📋 Method 1: ดึงจาก /team endpoint...');
    const teamResponse = await client.get('/team');
    const teams = teamResponse.data.teams;
    const targetTeam = teams.find(team => team.id === teamId);
    
    if (targetTeam && targetTeam.members) {
      console.log(`✅ พบ team: ${targetTeam.name}`);
      console.log(`👥 Members จาก /team:`);
      
      targetTeam.members.forEach((member, index) => {
        console.log(`   ${index + 1}. ${member.username || 'N/A'}`);
        console.log(`      ID: ${member.id || 'N/A'}`);
        console.log(`      Email: ${member.email || 'N/A'}`);
        console.log(`      Role: ${member.role || 'N/A'}\n`);
      });
    }

    // Method 2: ลองดึงจาก workspace members
    console.log('📋 Method 2: ดึงจาก workspace members...');
    try {
      const spacesResponse = await client.get(`/team/${teamId}/space`);
      const spaces = spacesResponse.data.spaces;
      
      if (spaces.length > 0) {
        const spaceId = spaces[0].id;
        console.log(`📁 ใช้ space: ${spaces[0].name} (${spaceId})`);
        
        // ลองดึง members จาก space
        const spaceResponse = await client.get(`/space/${spaceId}`);
        const spaceData = spaceResponse.data;
        
        if (spaceData.members) {
          console.log(`✅ Members จาก space:`);
          spaceData.members.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.username || 'N/A'}`);
            console.log(`      ID: ${member.id || 'N/A'}`);
            console.log(`      Email: ${member.email || 'N/A'}\n`);
          });
        }
      }
    } catch (spaceError) {
      console.log('⚠️ ไม่สามารถดึงจาก space members');
    }

    // Method 3: ดึงจาก current user
    console.log('📋 Method 3: Current user info...');
    const userResponse = await client.get('/user');
    const currentUser = userResponse.data.user;
    
    console.log(`✅ Current User:`);
    console.log(`   Username: ${currentUser.username}`);
    console.log(`   ID: ${currentUser.id}`);
    console.log(`   Email: ${currentUser.email}`);

    // สร้าง template user-mapping.json
    console.log('\n📝 สร้าง template user-mapping.json...');
    
    const userMappingTemplate = {
      "251733361926733841": "your-email@domain.com",
      "414300827793227797": "friend-email@domain.com",
      "_comment": "Discord User ID → ClickUp Email mapping",
      "_instructions": [
        "1. แทนที่ your-email@domain.com ด้วย ClickUp email ของคุณ",
        "2. แทนที่ friend-email@domain.com ด้วย ClickUp email ของเพื่อน",
        "3. ลบ _comment และ _instructions หลังจากแก้ไขเสร็จ"
      ],
      "_discovered_users": {
        [`${currentUser.id}`]: currentUser.email
      }
    };

    // บันทึกลงไฟล์
    fs.writeFileSync('config/user-mapping.json', JSON.stringify(userMappingTemplate, null, 2));
    console.log('✅ สร้าง config/user-mapping.json เรียบร้อย!');
    
    console.log('\n🎯 ขั้นตอนต่อไป:');
    console.log('1. เปิดไฟล์ config/user-mapping.json');
    console.log('2. แก้ไข email addresses ให้ถูกต้อง');
    console.log('3. ลบ _comment และ _instructions');
    console.log('4. ทดสอบ Discord bot');

    // แสดงตัวอย่าง mapping ที่ควรจะเป็น
    console.log('\n📋 ตัวอย่าง mapping ที่ควรจะเป็น:');
    console.log('{');
    console.log('  "251733361926733841": "คุณ@email.com",');
    console.log('  "414300827793227797": "เพื่อน@email.com"');
    console.log('}');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📄 Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// เรียกใช้ฟังก์ชัน
if (require.main === module) {
  getTeamMembers();
}

module.exports = { getTeamMembers };