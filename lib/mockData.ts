export type Option = "A" | "B" | "C" | "D";

export interface Question {
  id: number;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: Option;
}

export const mockQuestions: Question[] = [
  {
    id: 1,
    question: "What is the capital of Nigeria?",
    options: { A: "Lagos", B: "Abuja", C: "Kano", D: "Ibadan" },
    correct_answer: "B",
  },
  {
    id: 2,
    question: "Which of these is a programming language?",
    options: { A: "HTML", B: "CSS", C: "Python", D: "JSON" },
    correct_answer: "C",
  },
  {
    id: 3,
    question: "What is 15 + 27?",
    options: { A: "32", B: "42", C: "52", D: "44" },
    correct_answer: "B",
  },
  {
    id: 4,
    question: "Which planet is known as the Red Planet?",
    options: { A: "Venus", B: "Mars", C: "Jupiter", D: "Saturn" },
    correct_answer: "B",
  },
  {
    id: 5,
    question: "Who wrote 'Romeo and Juliet'?",
    options: { A: "Charles Dickens", B: "William Shakespeare", C: "Jane Austen", D: "Mark Twain" },
    correct_answer: "B",
  },
  // Adding more mock questions to reach 40...
  ...Array.from({ length: 35 }, (_, i) => ({
    id: i + 6,
    question: `Mock Question ${i + 6}: What is ${i + 6} * 2?`,
    options: {
      A: `${(i + 6) * 2}`,
      B: `${(i + 6) * 2 + 1}`,
      C: `${(i + 6) * 2 - 1}`,
      D: `${(i + 6) * 2 + 2}`,
    },
    correct_answer: "A" as Option,
  })),
];
