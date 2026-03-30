export interface Question {
  q: string;
  opts: string[];
  a: string;
  yr: number;
}

export type QuestionBank = Record<string, Question[]>;

export const QB: QuestionBank = {
  "English Language": [
    { q: "Choose the word nearest in meaning to EXHAUSTIVE: The professor gave an EXHAUSTIVE lecture.", opts: ["A. Tiring", "B. Comprehensive", "C. Short", "D. Interesting"], a: "B", yr: 2022 },
    { q: "Choose the correct preposition: The students were warned _____ lateness.", opts: ["A. against", "B. about", "C. for", "D. on"], a: "A", yr: 2021 },
    { q: "Identify the figure of speech: 'The wind whispered through the trees.'", opts: ["A. Simile", "B. Metaphor", "C. Personification", "D. Hyperbole"], a: "C", yr: 2023 },
    { q: "Choose the word with the same vowel sound as SEAT.", opts: ["A. Set", "B. Said", "C. See", "D. Sale"], a: "C", yr: 2020 },
    { q: "In 'Neither the students nor the teacher was present', which concord rule applies?", opts: ["A. Proximity rule", "B. Notional concord", "C. Grammatical concord", "D. Collective noun rule"], a: "A", yr: 2022 },
    { q: "Which word has a different stress pattern from the others: ECONOMY, GEOGRAPHY, TELEVISION, DEMOCRACY?", opts: ["A. ECONOMY", "B. GEOGRAPHY", "C. TELEVISION", "D. DEMOCRACY"], a: "C", yr: 2019 },
    { q: "'You had better see a doctor' is best described as:", opts: ["A. A command", "B. A piece of advice", "C. A threat", "D. A refusable suggestion"], a: "B", yr: 2021 },
    { q: "Choose the correctly spelled word to complete: A hospital is where sick people are ___.", opts: ["A. treeted", "B. treated", "C. treatted", "D. treateed"], a: "B", yr: 2023 },
    { q: "Identify the mood in: 'If I were the president, I would fix the roads.'", opts: ["A. Indicative", "B. Imperative", "C. Subjunctive", "D. Infinitive"], a: "C", yr: 2020 },
    { q: "Choose the antonym of LOQUACIOUS.", opts: ["A. Talkative", "B. Reserved", "C. Noisy", "D. Eloquent"], a: "B", yr: 2022 },
  ],
  "Physics": [
    { q: "A ball is thrown vertically upward at 20 m/s. What is the maximum height? (g = 10 m/s²)", opts: ["A. 10 m", "B. 20 m", "C. 40 m", "D. 80 m"], a: "B", yr: 2022 },
    { q: "Which correctly states Ohm's Law?", opts: ["A. V = I/R", "B. V = IR", "C. V = I²R", "D. V = R/I"], a: "B", yr: 2021 },
    { q: "The bending of light passing from one medium to another is called:", opts: ["A. Reflection", "B. Diffraction", "C. Refraction", "D. Dispersion"], a: "C", yr: 2023 },
    { q: "A machine has velocity ratio 5 and efficiency 80%. What is the mechanical advantage?", opts: ["A. 2", "B. 4", "C. 6.25", "D. 8"], a: "B", yr: 2020 },
    { q: "Which of the following is NOT a scalar quantity?", opts: ["A. Mass", "B. Temperature", "C. Velocity", "D. Speed"], a: "C", yr: 2022 },
    { q: "Find E where h = 6.6×10⁻³⁴ Js and f = 5×10¹⁴ Hz (E = hf).", opts: ["A. 3.3×10⁻¹⁹ J", "B. 6.6×10⁻¹⁹ J", "C. 1.32×10⁻¹⁹ J", "D. 3.3×10⁻²⁰ J"], a: "A", yr: 2021 },
    { q: "Which statement about radioactive decay is CORRECT?", opts: ["A. Alpha particles have highest penetrating power", "B. Beta particles are helium nuclei", "C. Gamma rays have highest penetrating power", "D. Alpha particles are least ionizing"], a: "C", yr: 2023 },
    { q: "A sound wave: frequency 256 Hz, wavelength 1.3 m. What is the wave speed?", opts: ["A. 197 m/s", "B. 256 m/s", "C. 333 m/s", "D. 512 m/s"], a: "C", yr: 2019 },
    { q: "Which device converts mechanical energy to electrical energy?", opts: ["A. Electric motor", "B. Transformer", "C. Generator", "D. Capacitor"], a: "C", yr: 2022 },
    { q: "Half-life of element = 8 days. Starting with 80g, how much remains after 24 days?", opts: ["A. 5 g", "B. 10 g", "C. 20 g", "D. 40 g"], a: "B", yr: 2021 },
  ],
  "Chemistry": [
    { q: "What is the oxidation number of sulphur in H₂SO₄?", opts: ["A. +2", "B. +4", "C. +6", "D. -2"], a: "C", yr: 2022 },
    { q: "Which is a property of ionic compounds?", opts: ["A. Low melting point", "B. Conducts electricity when dissolved in water", "C. Soluble only in organic solvents", "D. Made of molecules"], a: "B", yr: 2021 },
    { q: "A solid changing directly to gas without passing through liquid is called:", opts: ["A. Evaporation", "B. Condensation", "C. Sublimation", "D. Deposition"], a: "C", yr: 2023 },
    { q: "Which element has electronic configuration 2, 8, 8, 1?", opts: ["A. Sodium (Na)", "B. Potassium (K)", "C. Calcium (Ca)", "D. Argon (Ar)"], a: "B", yr: 2020 },
    { q: "Which best describes a catalyst?", opts: ["A. It is consumed in the reaction", "B. It increases activation energy", "C. It speeds up reaction without being consumed", "D. It only works in acid solutions"], a: "C", yr: 2022 },
    { q: "What type of reaction is: CH₄ + 2O₂ → CO₂ + 2H₂O?", opts: ["A. Decomposition", "B. Displacement", "C. Neutralization", "D. Combustion"], a: "D", yr: 2021 },
    { q: "The pH of a solution is 3. What is the concentration of H⁺ ions?", opts: ["A. 10⁻³ mol/dm³", "B. 10³ mol/dm³", "C. 3 mol/dm³", "D. 10⁻¹¹ mol/dm³"], a: "A", yr: 2023 },
    { q: "Which is an example of a homogeneous mixture?", opts: ["A. Sand and water", "B. Oil and water", "C. Salt solution", "D. Muddy water"], a: "C", yr: 2019 },
    { q: "What is the IUPAC name of CH₃CH₂OH?", opts: ["A. Methanol", "B. Ethanol", "C. Propanol", "D. Butanol"], a: "B", yr: 2022 },
    { q: "Calculate molar mass of CaCO₃ (Ca=40, C=12, O=16).", opts: ["A. 68 g/mol", "B. 84 g/mol", "C. 100 g/mol", "D. 116 g/mol"], a: "C", yr: 2021 },
  ],
  "Biology": [
    { q: "Which organelle is responsible for producing ATP (energy) in a cell?", opts: ["A. Nucleus", "B. Ribosome", "C. Mitochondria", "D. Golgi apparatus"], a: "C", yr: 2022 },
    { q: "Man with blood group AB marries woman with blood group O. Possible blood groups in children?", opts: ["A. A and B only", "B. AB and O only", "C. A, B, AB and O", "D. O only"], a: "A", yr: 2021 },
    { q: "The process by which green plants make food using sunlight is called:", opts: ["A. Respiration", "B. Transpiration", "C. Photosynthesis", "D. Fermentation"], a: "C", yr: 2023 },
    { q: "Which correctly describes osmosis?", opts: ["A. Movement of solutes from high to low concentration", "B. Movement of water from low to high solute concentration through semi-permeable membrane", "C. Active transport of water against gradient", "D. Movement of gases across membranes"], a: "B", yr: 2020 },
    { q: "Which part of the brain controls balance and coordination?", opts: ["A. Cerebrum", "B. Medulla oblongata", "C. Hypothalamus", "D. Cerebellum"], a: "D", yr: 2022 },
    { q: "Which is NOT a function of the liver?", opts: ["A. Detoxification of alcohol", "B. Production of bile", "C. Storage of glycogen", "D. Production of insulin"], a: "D", yr: 2021 },
    { q: "A cell in metaphase has 46 chromosomes. How many chromosomes will each daughter cell have after mitosis?", opts: ["A. 23", "B. 46", "C. 92", "D. 12"], a: "B", yr: 2023 },
    { q: "Which blood cells are primarily responsible for fighting infections?", opts: ["A. Red blood cells", "B. Platelets", "C. White blood cells", "D. Plasma cells"], a: "C", yr: 2019 },
    { q: "The theory of evolution by natural selection was proposed by:", opts: ["A. Gregor Mendel", "B. Louis Pasteur", "C. Charles Darwin", "D. Robert Hooke"], a: "C", yr: 2022 },
    { q: "Which is the correct sequence of the alimentary canal?", opts: ["A. Mouth→Oesophagus→Stomach→Large intestine→Small intestine", "B. Mouth→Stomach→Oesophagus→Small intestine→Large intestine", "C. Mouth→Oesophagus→Stomach→Small intestine→Large intestine", "D. Mouth→Oesophagus→Large intestine→Small intestine→Stomach"], a: "C", yr: 2021 },
  ],
};

export const SUBJECTS = Object.keys(QB);
