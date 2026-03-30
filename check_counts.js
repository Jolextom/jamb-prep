const fs = require('fs');
const subjects = ['english', 'physics', 'chemistry', 'biology', 'crk', 'government', 'englishlit'];
const targets = {
    english: 500,
    physics: 500,
    chemistry: 500,
    biology: 500,
    crk: 500,
    government: 500,
    englishlit: 500
};

subjects.forEach(subject => {
    const filePath = `public/data/${subject}.json`;
    if (fs.existsSync(filePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`${subject}: ${data.length}/${targets[subject]} ${data.length >= targets[subject] ? '✅' : '❌'}`);
        } catch (e) {
            console.log(`${subject}: Error reading file ❌`);
        }
    } else {
        console.log(`${subject}: Missing ❌`);
    }
});
