require('dotenv').config();
const axios = require('axios');

async function debugTeamMembers() {
  const client = axios.create({
    baseURL: 'https://api.clickup.com/api/v2',
    headers: {
      'Authorization': process.env.CLICKUP_API_TOKEN,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });

  try {
    console.log('🔍 Debug: ตรวจสอบข้อมูลสมาชิก team...\n');
    
    const teamId = process.env.CLICKUP_TEAM_ID;
    const teamResponse = await client.get('/team');
    
    const teams = teamResponse.data.teams;
    const targetTeam = teams.find(team => team.id === teamId);
    
    if (targetTeam) {
      console.log(`🏢 Team: ${targetTeam.name} (ID: ${targetTeam.id})`);
      console.log(`👥 Members array length: ${targetTeam.members?.length || 0}`);
      console.log('\n📋 รายละเอียดสมาชิกทั้งหมด:');
      
      if (targetTeam.members && targetTeam.members.length > 0) {
        targetTeam.members.forEach((member, index) => {
          console.log(`\n👤 สมาชิกคนที่ ${index + 1}:`);
          console.log(`   Username: ${member.username || 'N/A'}`);
          console.log(`   Email: ${member.email || 'N/A'}`);
          console.log(`   ID: ${member.id || 'N/A'}`);
          console.log(`   Role: ${member.role || 'N/A'}`);
          console.log(`   Invited: ${member.invited || 'N/A'}`);
          console.log(`   Status: ${member.status || 'N/A'}`);
          console.log(`   Full object:`, JSON.stringify(member, null, 2));
        });
      } else {
        console.log('   ❌ ไม่มีข้อมูลสมาชิกหรือ array ว่าง');
      }
      
      console.log('\n🔍 Full team object:');
      console.log(JSON.stringify(targetTeam, null, 2));
      
    } else {
      console.error(`❌ ไม่พบ team ID: ${teamId}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error(`📊 Status: ${error.response.status}`);
      console.error(`📄 Response:`, error.response.data);
    }
  }
}

debugTeamMembers();