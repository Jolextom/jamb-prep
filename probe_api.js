const axios = require('axios');
const fs = require('fs');
const TOKEN = "ALOC-71329e098ec1488987b9";

async function probe() {
    try {
        const res = await axios.get('https://questions.aloc.com.ng/api/v2/q?subject=chemistry', {
            headers: { 'AccessToken': TOKEN }
        });
        fs.writeFileSync('probe.json', JSON.stringify(res.data, null, 2));
        console.log("Probe saved to probe.json");
    } catch (e) {
        console.error(e.message);
    }
}
probe();
