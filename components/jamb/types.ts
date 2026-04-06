// ALOC V2 Supported Subjects with metadata
export const SUBJECT_METADATA = [
  {
    name: "English Language",
    slug: "english",
    default: 60,
    fixedExamCount: 60,
    isReady: true,
  },
  {
    name: "Mathematics",
    slug: "mathematics",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Physics",
    slug: "physics",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Chemistry",
    slug: "chemistry",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Biology",
    slug: "biology",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Economics",
    slug: "economics",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Geography",
    slug: "geography",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Government",
    slug: "government",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Commerce",
    slug: "commerce",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Accounting",
    slug: "accounting",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Islamic Religious Studies (IRK)",
    slug: "irk",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "History",
    slug: "history",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Agricultural Science",
    slug: "agric",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Computer Studies",
    slug: "computerstudies",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Home Economics",
    slug: "homeeconomics",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Hausa",
    slug: "hausa",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Igbo",
    slug: "igbo",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "French",
    slug: "french",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Physical Education",
    slug: "physicaleducation",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Fine Arts",
    slug: "finearts",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Music",
    slug: "music",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Arabic",
    slug: "arabic",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Yoruba",
    slug: "yoruba",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Religious Studies (CRK)",
    slug: "crk",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
  {
    name: "Literature-in-English",
    slug: "englishlit",
    default: 40,
    fixedExamCount: 40,
    isReady: true,
  },
] as const;

export interface Question {
  id: number;
  q: string;
  options: Record<string, string>;
  a: string;
  yr: string;
  topic?: string;
  sub_topic?: string;
  difficulty?: string;
  solution?: string;
  section?: string;
  image?: string;
  hasPassage?: number;
  questionNub?: number | null;
  novel_id?: number | null;
  novel_title?: string;
  isChallenge?: boolean;
  isReviewable?: boolean;
}

export interface SubjectConfig {
  selected: boolean;
  count: number;
}

export type SubjectConfigs = Record<string, SubjectConfig>;
