const axios = require('axios');
const TOKEN = "ALOC-71329e098ec1488987b9"; 

const subjects = ['mathematics', 'economics', 'commerce', 'accounting'];

async function testSubjects() {
    for (const s of subjects) {
        try {
            const res = await axios.get(`https://questions.aloc.com.ng/api/v2/q?subject=${s}`, {
                headers: { 'AccessToken': TOKEN },
                timeout: 5000
            });
            if (res.data && res.data.data) {
                console.log(`✅ [${s}] is available! Example ID: ${res.data.data.id}`);
            } else {
                console.log(`❌ [${s}] returned no data.`);
            }
        } catch (e) {
            console.log(`❌ [${s}] Error: ${e.message}`);
        }
    }
}

testSubjects();
