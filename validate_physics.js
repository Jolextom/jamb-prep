const fs = require("fs");
const data = JSON.parse(fs.readFileSync("public/data/physics.json", "utf8"));

console.log("=== PHYSICS.JSON VALIDATION SUMMARY ===\n");

console.log("1. REMOVED FLAWED QUESTION:");
console.log(
  "   ID 116:",
  !data.find((x) => x.id === 116) ? "✓ REMOVED" : "✗ STILL EXISTS",
);

console.log("\n2. MISSING LEADING DIGITS SAMPLE:");
const samples = [
  { id: 704, opt: "a", val: "1.05 × 10³ s" },
  { id: 403, opt: "b", val: "2.0 × 10⁸ ms⁻¹" },
  { id: 862, opt: "c", val: "1.02 kg" },
  { id: 1085, opt: "d", val: "11.3 km s⁻¹" },
];
samples.forEach((s) => {
  const q = data.find((x) => x.id === s.id);
  const actual = q ? q.options[s.opt] : "MISSING";
  console.log(`   ID ${s.id}: ${actual === s.val ? "✓" : "✗"}`);
});

console.log("\n3. ANSWER KEY CORRECTIONS:");
const keys = [
  { id: 160, expected: "b" },
  { id: 104, expected: "c" },
  { id: 975, expected: "a" },
  { id: 423, expected: "b" },
  { id: 878, expected: "a" },
];
keys.forEach((k) => {
  const q = data.find((x) => x.id === k.id);
  if (q)
    console.log(
      `   ID ${k.id}: ${q.answer === k.expected ? "✓" : "✗"} (${q.answer})`,
    );
});

console.log("\n4. RATIO FORMATTING:");
console.log(`   ID 164 opt a: ${data.find((x) => x.id === 164).options.a}`);
console.log(`   ID 828 opt a: ${data.find((x) => x.id === 828).options.a}`);

console.log("\n5. ALT TAG CLEANUP:");
const content = fs.readFileSync("public/data/physics.json", "utf8");
const altCount = (content.match(/\(Alt/g) || []).length;
console.log(
  `   (Alt) tags remaining: ${altCount} ${altCount === 0 ? "✓" : "✗"}`,
);

console.log("\n6. FILE STATUS:");
console.log(`   Total questions: ${data.length}`);
console.log(`   JSON valid: ✓`);

console.log("\n=== VALIDATION COMPLETE ===");
