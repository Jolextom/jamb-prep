const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN = "ALOC-71329e098ec1488987b9"; 
const DELAY_MS = 300; 
const STALL_THRESHOLD = 50; // Pause subject if 50 consecutive duplicates
const DATA_DIR = 'public/data';

const targets = {
    crk: 657,         
    government: 590,
    englishlit: 655
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchQuestions() {
    console.log("🚀 Starting the ROUND-ROBIN JAMB Data Heist...");
    
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    let banks = {};
    let uniqueIds = {};
    let stalled = {};
    let consecutiveDuplicates = {};
    let completed = {};

    // Initial Load
    for (const subject of Object.entries(targets).map(t => t[0])) {
        const filePath = path.join(DATA_DIR, `${subject}.json`);
        banks[subject] = [];
        uniqueIds[subject] = new Set();
        consecutiveDuplicates[subject] = 0;
        stalled[subject] = false;
        completed[subject] = false;

        if (fs.existsSync(filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                if (Array.isArray(data)) {
                    banks[subject] = data;
                    data.forEach(q => { if (q.id) uniqueIds[subject].add(q.id); });
                    console.log(`♻️  [${subject.toUpperCase()}] Resumed: ${banks[subject].length} questions.`);
                }
            } catch (e) {
                console.warn(`⚠️  [${subject}] Parse error, starting fresh.`);
            }
        }
        if (banks[subject].length >= targets[subject]) {
            completed[subject] = true;
            console.log(`✅ [${subject}] Already complete.`);
        }
    }

    let active = true;
    while (active) {
        active = false;
        for (const [subject, targetCount] of Object.entries(targets)) {
            if (completed[subject] || stalled[subject]) continue;
            
            active = true; // Still have work to do
            
            try {
                const response = await axios.get(`https://questions.aloc.com.ng/api/v2/q?subject=${subject}`, {
                    headers: { 
                        'AccessToken': TOKEN,
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    timeout: 8000
                });

                const q = response.data.data;
                if (q && q.id) {
                    if (!uniqueIds[subject].has(q.id)) {
                        uniqueIds[subject].add(q.id);
                        banks[subject].push(q);
                        consecutiveDuplicates[subject] = 0;
                        
                        // Checkpoint
                        const filePath = path.join(DATA_DIR, `${subject}.json`);
                        fs.writeFileSync(filePath, JSON.stringify(banks[subject], null, 2));

                        if (banks[subject].length >= targetCount) {
                            completed[subject] = true;
                            console.log(`\n🎉 [${subject.toUpperCase()}] Target Reached: ${targetCount}!`);
                        }
                    } else {
                        consecutiveDuplicates[subject]++;
                        if (consecutiveDuplicates[subject] >= STALL_THRESHOLD) {
                            stalled[subject] = true;
                            console.log(`\n🛑 [${subject.toUpperCase()}] Stalled after ${STALL_THRESHOLD} duplicates. Moving on.`);
                        }
                    }
                }
                
                process.stdout.write(`\rHeist Progress -> ${Object.entries(banks).map(([s, b]) => `${s[0].toUpperCase()}:${b.length}${stalled[s]?'🛑':completed[s]?'✅':''}`).join(' | ')}`);
                
            } catch (error) {
                console.error(`\n❌ [${subject}] Error: ${error.message}`);
                await sleep(5000); // Cool down on error
            }

            await sleep(DELAY_MS);
        }
    }

    console.log("\n\n🏁 HEIST CYCLE FINISHED.");
    const summary = Object.entries(banks).map(([s, b]) => `${s}: ${b.length} (${completed[s] ? 'COMPLETE' : stalled[s] ? 'STALLED' : 'PARTIAL'})`).join('\n');
    console.log(summary);
}

fetchQuestions();
