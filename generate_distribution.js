const fs = require('fs');

const standardTopics = [
    "Separation of Mixtures",
    "Chemical Combination",
    "Gas Laws",
    "Atomic Structure",
    "Periodicity",
    "Chemical Bonding",
    "Stoichiometry",
    "Energetics",
    "Kinetics",
    "Equilibrium",
    "Solubility",
    "Acids/Bases/Salts",
    "Environmental Chemistry",
    "Organic Chemistry",
    "Metals & Their Compounds",
    "Non-Metals & Their Compounds"
];

const data = JSON.parse(fs.readFileSync('chemistry_master_db.json', 'utf8'));
const total = data.length;

let stats = {};

data.forEach(q => {
    const topic = q.topic || "Uncategorized";
    const subTopic = q.sub_topic || "Uncategorized";

    if (!stats[topic]) {
        stats[topic] = { count: 0, subTopics: {} };
    }
    stats[topic].count += 1;
    if (!stats[topic].subTopics[subTopic]) {
        stats[topic].subTopics[subTopic] = 0;
    }
    stats[topic].subTopics[subTopic] += 1;
});

console.log("# Chemistry Question Distribution Report\n");
console.log(`**Total Questions**: ${total}\n`);

console.log("| Topic | Count | Percentage | Sub-topics Breakdown |");
console.log("| :--- | :--- | :--- | :--- |");

standardTopics.forEach(topic => {
    const entry = stats[topic] || { count: 0, subTopics: {} };
    const percentage = ((entry.count / total) * 100).toFixed(1);
    const subBreakdown = Object.entries(entry.subTopics)
        .map(([sub, count]) => `${sub} (${count})`)
        .join(', ');
    
    console.log(`| ${topic} | ${entry.count} | ${percentage}% | ${subBreakdown || "None"} |`);
});

// Any other categories found?
Object.keys(stats).forEach(topic => {
    if (!standardTopics.includes(topic)) {
        const entry = stats[topic];
        const percentage = ((entry.count / total) * 100).toFixed(1);
        const subBreakdown = Object.entries(entry.subTopics)
            .map(([sub, count]) => `${sub} (${count})`)
            .join(', ');
        console.log(`| ${topic} (Non-Syllabus?) | ${entry.count} | ${percentage}% | ${subBreakdown} |`);
    }
});

console.log("\n## Gap Analysis (Topics < 10 questions)\n");
const gaps = standardTopics.filter(topic => (stats[topic] ? stats[topic].count : 0) < 10);
if (gaps.length > 0) {
    gaps.forEach(topic => {
        const count = stats[topic] ? stats[topic].count : 0;
        console.log(`- **${topic}**: ${count} questions (GAP: Need ${10 - count} more)`);
    });
} else {
    console.log("No major gaps found (>10 questions per topic).");
}
