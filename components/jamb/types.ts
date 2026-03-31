// ALOC V2 Supported Subjects with metadata
export const SUBJECT_METADATA = [
  { name: "English Language", slug: "english", default: 60, fixedExamCount: 60, isReady: true },
  { name: "Mathematics", slug: "mathematics", default: 40, fixedExamCount: 40, isReady: false },
  { name: "Physics", slug: "physics", default: 40, fixedExamCount: 40, isReady: true },
  { name: "Chemistry", slug: "chemistry", default: 40, fixedExamCount: 40, isReady: true },
  { name: "Biology", slug: "biology", default: 40, fixedExamCount: 40, isReady: true },
  { name: "Economics", slug: "economics", default: 40, fixedExamCount: 40, isReady: false },
  { name: "Government", slug: "government", default: 40, fixedExamCount: 40, isReady: true },
  { name: "Commerce", slug: "commerce", default: 40, fixedExamCount: 40, isReady: false },
  { name: "Accounting", slug: "accounting", default: 40, fixedExamCount: 40, isReady: false },
  { name: "Religious Studies (CRK)", slug: "crk", default: 40, fixedExamCount: 40, isReady: true },
  { name: "Literature-in-English", slug: "englishlit", default: 40, fixedExamCount: 40, isReady: true },
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
  isChallenge?: boolean;
  isReviewable?: boolean;
}

export interface SubjectConfig {
  selected: boolean;
  count: number;
}

export type SubjectConfigs = Record<string, SubjectConfig>;
