/**
 * Fisher-Yates Shuffle Algorithm for true randomization
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

import React, { useState, useEffect, useCallback, useRef } from "react";
import { SUBJECT_METADATA, Question, SubjectConfig, SubjectConfigs } from "./jamb/types";
import SetupScreen from "./jamb/SetupScreen";
import ExamInterface from "./jamb/ExamInterface";
import Calculator from "./jamb/Calculator";
import Modals from "./jamb/Modals";
import "./jamb-replica.css";
import useCheckUpdate from "@/lib/hooks/useCheckUpdate";

export default function JambReplica() {
  // Navigation State
  const [view, setView] = useState<'SETUP' | 'EXAM' | 'REVIEW'>('SETUP');

  // Setup States
  const [examStarted, setExamStarted] = useState(false);
  const [configs, setConfigs] = useState<SubjectConfigs>(() => {
    const initial: SubjectConfigs = {};
    SUBJECT_METADATA.forEach((m) => {
      initial[m.name] = { selected: false, count: Math.min(10, m.fixedExamCount || 60) };
    });
    return initial;
  });
  const [sessionMode, setSessionMode] = useState<'EXAM' | 'PRACTICE'>('PRACTICE');
  const [candidateName, setCandidateName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("jamb_candidate_name") || "";
    }
    return "";
  });

  // Sync name to local storage
  useEffect(() => {
    localStorage.setItem("jamb_candidate_name", candidateName);
  }, [candidateName]);

  // Exam States
  const [activeSubjects, setActiveSubjects] = useState<string[]>([]);
  const [curSubIdx, setCurSubIdx] = useState(0);
  const [curQIdx, setCurQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fullPool, setFullPool] = useState<Question[]>([]); // For context injection
  const [totalSecs, setTotalSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // API State
  const [isLoading, setIsLoading] = useState(false);
  const [isBooting, setIsBooting] = useState(false);
  const [qbState, setQbState] = useState<Record<string, Question[]>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Update check
  const updateAvailable = useCheckUpdate();

  useEffect(() => {
    if (updateAvailable && view === 'SETUP' && !isLoading && !examStarted) {
      console.log("Update available! Performing silent refresh...");
      window.location.reload();
    }
  }, [updateAvailable, view, isLoading, examStarted]);

  // Chat Persistence State
  const [chatHistories, setChatHistories] = useState<Record<number, any[]>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("jamb_prep_chats");
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  // Sync chats to local storage
  useEffect(() => {
    localStorage.setItem("jamb_prep_chats", JSON.stringify(chatHistories));
  }, [chatHistories]);

  // Modal states
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [resultModalOpen, setResultModalOpen] = useState(false);

  // Result states
  const [finalScore, setFinalScore] = useState(0);
  const [jambScore, setJambScore] = useState(0);
  const [breakdown, setBreakdown] = useState<string[]>([]);
  const [diagnosticJSON, setDiagnosticJSON] = useState("");
  const [isFinished, setIsFinished] = useState(false);

  // Review states
  const [isReview, setIsReview] = useState(false);
  const [reviewAnswers, setReviewAnswers] = useState<Record<string, string>>({});
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([]);
  const [reviewHacks, setReviewHacks] = useState<Record<number, string>>({});

  const [isDataReady, setIsDataReady] = useState(false);
  const [imageAliases, setImageAliases] = useState<Record<string, string>>({});
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState("0");
  const [calcPos, setCalcPos] = useState({ top: 0, left: 0 });
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const calcRef = useRef<HTMLDivElement>(null);

  const key = useCallback((sIdx: number, qIdx: number) => `${sIdx}-${qIdx}`, []);

  // Tracking Helper
  const trackEvent = async (type: 'chat' | 'session', detail: string) => {
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: candidateName, detail }),
      });
    } catch (e) {
      console.warn("Tracking failed", e);
    }
  };

  const totalQuestionsTotal = Object.entries(configs)
    .filter(([_, c]) => c.selected)
    .reduce((acc, [_, c]) => acc + c.count, 0);

  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [resumePromptOpen, setResumePromptOpen] = useState(false);
  // Sync state to localStorage
  useEffect(() => {
    if (examStarted && !isFinished) {
      const session = {
        qbState,
        activeSubjects,
        answers,
        totalSecs,
        curSubIdx,
        curQIdx,
        sessionMode,
        configs,
        candidateName
      };
      localStorage.setItem("jamb_prep_session", JSON.stringify(session));
    }
  }, [examStarted, isFinished, qbState, activeSubjects, answers, totalSecs, curSubIdx, curQIdx, sessionMode, configs]);

  // Load Full Pool for context injection (Mastery Mode)
  useEffect(() => {
    if (activeSubjects.length === 1 && sessionMode === 'PRACTICE') {
      const sub = activeSubjects[0];
      const metadata = SUBJECT_METADATA.find(m => m.name === sub);
      if (metadata) {
        fetch(`/data/${metadata.slug}.json`)
          .then(r => r.json())
          .then(data => setFullPool(data))
          .catch(err => console.error("Failed to load pool for context:", err));
      }
    }
  }, [activeSubjects, sessionMode]);

  // Warning before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (examStarted && !isFinished) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [examStarted, isFinished]);

  // Check for saved session on mount
  useEffect(() => {
    const saved = localStorage.getItem("jamb_prep_session");
    if (saved) {
      setHasSavedSession(true);
      setResumePromptOpen(true);
    }
  }, []);

  const resumeExam = () => {
    const saved = localStorage.getItem("jamb_prep_session");
    if (saved) {
      try {
        const session = JSON.parse(saved);
        setQbState(session.qbState);
        setActiveSubjects(session.activeSubjects);
        setAnswers(session.answers);
        setTotalSecs(session.totalSecs);
        setSessionMode(session.sessionMode || (session.isExamMode ? 'EXAM' : 'PRACTICE'));
        setConfigs(session.configs);
        setCandidateName(session.candidateName || localStorage.getItem("jamb_candidate_name") || "");
        setCurSubIdx(session.curSubIdx ?? 0);
        setCurQIdx(session.curQIdx ?? 0);
        setExamStarted(true);
        setResumePromptOpen(false);
        setView('EXAM');
      } catch (e) {
        console.error("Failed to resume session:", e);
        localStorage.removeItem("jamb_prep_session");
        setResumePromptOpen(false);
      }
    }
  };

  const clearSession = () => {
    localStorage.removeItem("jamb_prep_session");
    setHasSavedSession(false);
    setResumePromptOpen(false);
  };

  // Check available subjects from manifest
  useEffect(() => {
    async function checkAvailability() {
      try {
        const res = await fetch("/data/manifest.json");
        if (res.ok) {
          const manifest = await res.json() as Record<string, number>;

          const found: string[] = [];
          const counts: Record<string, number> = {};

          SUBJECT_METADATA.forEach(m => {
            if (manifest[m.slug]) {
              found.push(m.name);
              counts[m.name] = manifest[m.slug];
            }
          });

          setAvailableSubjects(found);
          setAvailableCounts(counts);
          setIsDataReady(true);

          // Clip initial counts if they exceed available
          setConfigs(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(name => {
              const maxAllowed = Math.min(counts[name] || 60, 60);
              if (next[name].count > maxAllowed) {
                next[name].count = maxAllowed;
              }
            });
            return next;
          });
        }
      } catch (e) {
        console.error("Error loading manifest:", e);
      }
    }
    checkAvailability();
  }, []);

  // Fetch Logic (Local Edition)
  const startExam = async (forcedTimeSecs?: number) => {
    const selected = Object.entries(configs)
      .filter(([name, c]) => c.selected && availableSubjects.includes(name))
      .map(([name]) => name);

    if (selected.length === 0) {
      alert("Please select at least one available subject.");
      return;
    }

    const invalidSelection = selected.some((name) => !configs[name] || configs[name].count < 1);
    if (invalidSelection) {
      alert("Please choose at least 1 question for each selected subject.");
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    const newQB: Record<string, Question[]> = {};
    let resolvedAliases = imageAliases;

    if (Object.keys(resolvedAliases).length === 0) {
      try {
        const aliasRes = await fetch("/data/image_aliases.json");
        if (aliasRes.ok) {
          const aliasData = await aliasRes.json();
          if (aliasData && typeof aliasData === "object") {
            resolvedAliases = aliasData as Record<string, string>;
            setImageAliases(resolvedAliases);
          }
        }
      } catch {
        // Fallback to raw image names when alias map is unavailable.
      }
    }

    try {
      for (const subjectName of selected) {
        const metadata = SUBJECT_METADATA.find(m => m.name === subjectName);
        const config = configs[subjectName];
        if (!metadata || !config) continue;

        const res = await fetch(`/data/${metadata.slug}.json`);
        if (!res.ok) {
          throw new Error(`Could not load local data for ${subjectName}`);
        }

        let allQuestions: any[] = await res.json();

        // 0. Golden CBT range: serve 2010+ only.
        allQuestions = allQuestions.filter((q) => {
          const rawYear = q.examyear ?? q.yr;
          const year = Number(String(rawYear ?? "").trim());
          return Number.isFinite(year) && year >= 2010;
        });

        // 1. Filter out novel-based questions (prescribed texts)
        if (metadata.slug === "english" || metadata.slug === "englishlit") {
          const novelKeywords = [
            "novel", "the life changer", "khadijat abubakar jalli",
            "the potter's wheel", "chukwuemeka ike",
            "the last days at forcados high school", "a.h. mohammed",
            "independence", "sweet sixteen", "umuchukwu"
          ];

          allQuestions = allQuestions.filter(q => {
            const text = (q.question + " " + q.section).toLowerCase();
            return !novelKeywords.some(kw => text.includes(kw));
          });
        }

        // 2. High-yield sampling: 70% from heavy repeated topics, 30% from minor topics.
        const pickStratifiedByTopic = (pool: any[], count: number): any[] => {
          if (count <= 0 || pool.length === 0) return [];

          const grouped: Record<string, any[]> = {};
          pool.forEach((q) => {
            const t = q.topic || "General";
            if (!grouped[t]) grouped[t] = [];
            grouped[t].push(q);
          });

          const topicNames = Object.keys(grouped);
          topicNames.forEach((t) => {
            grouped[t] = fisherYatesShuffle(grouped[t]);
          });

          const out: any[] = [];
          let topicIdx = 0;
          while (out.length < count) {
            const t = topicNames[topicIdx % topicNames.length];
            const q = grouped[t].pop();
            if (q) out.push(q);

            topicIdx++;
            if (topicIdx > count * 10) break;
          }
          return out;
        };

        const targetCount = Math.min(config.count, allQuestions.length);

        // For English, keep comprehension questions from one ref_id only.
        let mandatoryComprehensionSet: any[] = [];
        let candidatePool = allQuestions;
        if (metadata.slug === "english" && targetCount > 0) {
          const comprehensionGroups = new Map<string, any[]>();

          allQuestions.forEach((q) => {
            if (Number(q?.hasPassage || 0) !== 1) return;
            const refIdRaw = q?.ref_id;
            if (refIdRaw === null || refIdRaw === undefined || refIdRaw === "") return;
            const refId = String(refIdRaw).trim();
            if (!refId) return;

            const existing = comprehensionGroups.get(refId);
            if (existing) {
              existing.push(q);
            } else {
              comprehensionGroups.set(refId, [q]);
            }
          });

          if (comprehensionGroups.size > 0) {
            const refs = Array.from(comprehensionGroups.keys());
            const pickedRef = refs[Math.floor(Math.random() * refs.length)];
            mandatoryComprehensionSet = fisherYatesShuffle(comprehensionGroups.get(pickedRef) || []);

            candidatePool = allQuestions.filter((q) => {
              if (Number(q?.hasPassage || 0) !== 1) return true;
              const refId = String(q?.ref_id ?? "").trim();
              return refId === pickedRef;
            });
          } else {
            candidatePool = allQuestions.filter((q) => Number(q?.hasPassage || 0) !== 1);
          }
        }

        let picked: any[] = [];

        if (targetCount > 0) {
          const topicCounts: Record<string, number> = {};
          candidatePool.forEach((q) => {
            const t = (q.topic || "").toString().trim();
            if (!t) return;
            topicCounts[t] = (topicCounts[t] || 0) + 1;
          });

          const sortedTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]);
          const highYieldTopicCount = sortedTopics.length > 0
            ? Math.max(1, Math.ceil(sortedTopics.length * 0.3))
            : 0;
          const highYieldTopics = new Set(
            sortedTopics.slice(0, highYieldTopicCount).map(([topic]) => topic)
          );

          const topicKey = (q: { topic?: unknown }) => (q.topic || "").toString().trim();
          const highYieldPool = candidatePool.filter((q) => {
            const t = topicKey(q);
            return t && highYieldTopics.has(t);
          });
          const minorPool = candidatePool.filter((q) => {
            const t = topicKey(q);
            return !t || !highYieldTopics.has(t);
          });

          const highTarget = Math.min(Math.round(targetCount * 0.7), highYieldPool.length);
          const minorTarget = Math.min(targetCount - highTarget, minorPool.length);

          picked = [
            ...pickStratifiedByTopic(highYieldPool, highTarget),
            ...pickStratifiedByTopic(minorPool, minorTarget),
          ];

          // Fill any remainder from leftovers while keeping randomness.
          if (picked.length < targetCount) {
            const pickedKeys = new Set(picked.map((q) => `${q.id || ""}::${q.question || ""}`));
            const leftovers = fisherYatesShuffle(
              candidatePool.filter((q) => !pickedKeys.has(`${q.id || ""}::${q.question || ""}`))
            );
            picked = [...picked, ...leftovers.slice(0, targetCount - picked.length)];
          }

          if (mandatoryComprehensionSet.length > 0) {
            const pickedKeys = new Set(picked.map((q) => `${q.id || ""}::${q.question || ""}`));
            const mandatoryUnique = mandatoryComprehensionSet.filter(
              (q) => !pickedKeys.has(`${q.id || ""}::${q.question || ""}`)
            );

            if (mandatoryUnique.length >= targetCount) {
              picked = mandatoryUnique.slice(0, targetCount);
            } else {
              const mandatoryKeys = new Set(mandatoryUnique.map((q) => `${q.id || ""}::${q.question || ""}`));
              const filler = picked
                .filter((q) => !mandatoryKeys.has(`${q.id || ""}::${q.question || ""}`))
                .slice(0, targetCount - mandatoryUnique.length);
              picked = [...mandatoryUnique, ...filler];
            }
          }
        }

        // Final shuffle of the picked set so they aren't ordered by topic
        const finalPicked = fisherYatesShuffle(picked);

        newQB[subjectName] = finalPicked.map(item => {
          // Ensure answer is always a valid letter A-D
          const rawAnswer = (item.answer || "a").toString().substring(0, 1).toUpperCase();
          const validAnswer = ["A", "B", "C", "D"].includes(rawAnswer) ? rawAnswer : "A";
          const rawImage = String(item.image || "").trim();

          return {
            id: item.id || 0,
            q: item.question || item.q || "",
            options: item.options || item.option || (Array.isArray(item.opts) ? Object.fromEntries(item.opts.map((o: string) => [o.substring(0, 1).toLowerCase(), o.substring(3)])) : {}),
            a: validAnswer,
            yr: String(item.examyear || 2025),
            topic: item.topic || "",
            sub_topic: item.sub_topic || "",
            difficulty: item.difficulty || "Moderate",
            solution: item.solution || "",
            section: item.section || "",
            image: rawImage ? (resolvedAliases[rawImage] || rawImage) : "",
            hasPassage: item.hasPassage || 0,
            questionNub: item.questionNub || null
          };
        });
      }

      const activeWithQuestions = selected.filter((name) => (newQB[name] || []).length > 0);
      if (activeWithQuestions.length === 0) {
        alert("No questions available for your current filters. Please increase question count or adjust subjects.");
        setIsLoading(false);
        return;
      }

      setQbState(newQB);
      setActiveSubjects(activeWithQuestions);

      if (sessionMode === 'EXAM') {
        const timeToSet = typeof forcedTimeSecs === 'number' ? forcedTimeSecs : (totalQuestionsTotal * 40);
        setTotalSecs(timeToSet);
        setTimerRunning(true);
      } else {
        setTotalSecs(0); // Unlimited time for Practice
        setTimerRunning(false);
      }

      setFetchError(null);
      setView('EXAM');
      setExamStarted(true);
      setTimerRunning(true);
      setIsLoading(false);

      // Track session start
      trackEvent('session', `${sessionMode} Mode: ${selected.join(", ")}`);

      setCurSubIdx(0);
      setCurQIdx(0);
    } catch (err: any) {
      setFetchError(err.message || "Data Load Error");
      setIsLoading(false);
    }
  };

  const currentSubject = activeSubjects[curSubIdx];
  const currentQuestions = qbState[currentSubject] || [];
  const currentQuestion = currentQuestions[curQIdx];
  const currentKey = key(curSubIdx, curQIdx);

  // Submit Logic
  const submitExam = useCallback(() => {
    setTimerRunning(false);
    setEndModalOpen(false);
    setResultModalOpen(false);

    if (sessionMode === 'PRACTICE') {
      localStorage.removeItem("jamb_prep_session");
      localStorage.removeItem("jamb_prep_chats");

      // Compute practice scores and show the result modal
      let total = 0;
      let correct = 0;
      const resBreakdown: string[] = [];
      const diagnosticPayload: any[] = [];

      activeSubjects.forEach((s, sIdx) => {
        const qList = qbState[s] || [];
        let sc = 0;
        qList.forEach((q, qIdx) => {
          const userAnswer = answers[key(sIdx, qIdx)];
          if (userAnswer === q.a) sc++;
          else {
            diagnosticPayload.push({
              subject: s, question: q.q, options: q.options,
              chosen_option: userAnswer || "Skipped", correct_option: q.a,
            });
          }
        });
        resBreakdown.push(`${s}: ${sc}/${qList.length}`);
        total += qList.length;
        correct += sc;
      });

      const calculatedJamb = Math.round((correct / (total || 1)) * 400);
      setFinalScore(correct);
      setJambScore(calculatedJamb);
      setBreakdown(resBreakdown);
      setDiagnosticJSON(JSON.stringify(diagnosticPayload, null, 2));
      setIsFinished(true);
      setResultModalOpen(true);

      // Send practice session performance to admin
      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "performance",
          name: candidateName,
          detail: {
            mode: sessionMode,
            score: correct,
            jambScore: calculatedJamb,
            breakdown: resBreakdown,
            subjects: activeSubjects,
            totalQuestions: total,
            answeredCount: Object.keys(answers).length
          }
        })
      }).catch(err => console.log("Admin perf submit skipped:", err));

      return;
    }

    let total = 0;
    let correct = 0;
    const resBreakdown: string[] = [];
    const diagnosticPayload: any[] = [];

    activeSubjects.forEach((s, sIdx) => {
      const qList = qbState[s] || [];
      let sc = 0;
      qList.forEach((q, qIdx) => {
        const userAnswer = answers[key(sIdx, qIdx)];
        if (userAnswer === q.a) {
          sc++;
        } else {
          diagnosticPayload.push({
            subject: s,
            question: q.q,
            options: q.options,
            chosen_option: userAnswer || "Skipped",
            correct_option: q.a,
          });
        }
      });
      resBreakdown.push(`${s}: ${sc}/${qList.length}`);
      total += qList.length;
      correct += sc;
    });

    const calculatedJamb = Math.round((correct / (total || 1)) * 400);
    setFinalScore(correct);
    setJambScore(calculatedJamb);
    setBreakdown(resBreakdown);
    setDiagnosticJSON(JSON.stringify(diagnosticPayload, null, 2));
    setIsFinished(true);

    // Send performance data to admin dashboard
    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "performance",
        name: candidateName,
        detail: {
          mode: sessionMode,
          score: correct,
          jambScore: calculatedJamb,
          breakdown: resBreakdown,
          subjects: activeSubjects,
          totalQuestions: total,
          answeredCount: Object.keys(answers).length
        }
      })
    }).catch(err => console.log("Admin perf submit skipped:", err));

    // Auto-enter review - no modal
    setIsReview(true);
    setReviewAnswers(answers);
    setView('EXAM');
    setCurSubIdx(0);
    setCurQIdx(0);
    localStorage.removeItem("jamb_prep_session");
    localStorage.removeItem("jamb_prep_chats"); // Clear chats on finish
  }, [answers, qbState, activeSubjects, key]);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerRunning && totalSecs > 0) {
      interval = setInterval(() => {
        setTotalSecs((prev) => prev - 1);
      }, 1000);
    } else if (sessionMode === 'EXAM' && totalSecs <= 0 && timerRunning) {
      submitExam();
    }
    return () => clearInterval(interval);
  }, [timerRunning, totalSecs, submitExam, sessionMode]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const navigate = useCallback((dir: number) => {
    // We need current indices from refs or state closures might be tricky if not careful
    // But since this is inside a component, it's fine as long as we use latest values
    if (dir === 1) {
      if (curQIdx < currentQuestions.length - 1) {
        setCurQIdx(curQIdx + 1);
      } else if (curSubIdx < activeSubjects.length - 1) {
        setCurSubIdx(curSubIdx + 1);
        setCurQIdx(0);
      } else {
        setEndModalOpen(true);
      }
    } else {
      if (curQIdx > 0) {
        setCurQIdx(curQIdx - 1);
      } else if (curSubIdx > 0) {
        const prevIdx = curSubIdx - 1;
        setCurSubIdx(prevIdx);
        setCurQIdx((qbState[activeSubjects[prevIdx]] || []).length - 1);
      }
    }
  }, [curQIdx, currentQuestions.length, curSubIdx, activeSubjects.length, qbState, activeSubjects]);

  const jumpTo = (qi: number) => setCurQIdx(qi);
  const switchSubject = (i: number) => {
    setCurSubIdx(i);
    setCurQIdx(0);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes if the user focuses an input or textarea
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

      if (!examStarted || resultModalOpen || endModalOpen || isLoading) return;
      const k = e.key.toUpperCase();

      // Dynamic Shortcut Logic: Only allow keys for which a valid option exists
      const validOptions = Object.entries(currentQuestion?.options || {})
        .filter(([_, text]) => text && String(text).trim() !== "")
        .map(([letter]) => letter.toUpperCase());

      if (validOptions.includes(k)) {
        setAnswers(p => {
          // Block override in Practice mode if already answered
          if (sessionMode === 'PRACTICE' && p[currentKey]) return p;
          return { ...p, [currentKey]: k };
        });
      }
      if (k === "N") navigate(1);
      if (k === "P") navigate(-1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [curSubIdx, curQIdx, resultModalOpen, endModalOpen, isLoading, examStarted, navigate, currentKey, currentQuestion?.options, sessionMode]);

  // Click outside calculator
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // If clicking the toggle button itself, let the button's onClick handle it (toggle)
      if ((e.target as HTMLElement).closest(".calc-btn")) return;
      if (calcRef.current && !calcRef.current.contains(e.target as Node)) setCalcOpen(false);
    };
    if (calcOpen) document.addEventListener("mousedown", handleClick);
    else document.removeEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [calcOpen]);

  const copyDiagnosticData = () => {
    if (activeSubjects.length === 0) return;

    // Step A: Session Data
    const sessionQuestions = qbState[activeSubjects[0]] || [];
    const sessionData = sessionQuestions.map((q, qIdx) => {
      const userAns = answers[`0-${qIdx}`] || "Skipped";
      return {
        id: q.id,
        question: q.q,
        options: q.options,
        user_answer: userAns,
        correct_answer: q.a,
        solution: q.solution,
        topic: q.topic,
        sub_topic: q.sub_topic
      };
    });

    // Step B: Prompt Assembly
    const prompt = `You are an elite JAMB exam coach. Your task is to analyze the questions a student just failed and generate a fast "Speed Hack" for each.

YOUR INSTRUCTIONS:

1. THE TRUTH GUARDRAIL: 
JAMB past question databases often contain wrong 'correct_answer' letters. If the 'correct_answer' letter contradicts the factual explanation in the 'solution', YOU MUST TRUST THE 'SOLUTION'. Base your Speed Hack purely on the facts in the 'solution'.

2. THE "CHEAT CODE" FORMAT:
Do not write paragraphs. Do not use bullet points, emojis, or forced formatting. Write 1 or 2 conversational, punchy sentences. Tell the student exactly what word or number to look for in the question, and what answer it connects to. Point out the trap if there is an obvious one.

3. OUTPUT FORMAT:
Return ONLY a valid JSON object. No markdown formatting outside the JSON, no intro text.

JSON STRUCTURE:
{
  "subject": "${activeSubjects[0]}",
  "route": [
    {
      "topic": "Topic Name",
      "sub_topic": "Sub-topic Name",
      "original": {
        "id": 0,
        "question": "...",
        "options": {"a": "...", "b": "...", "c": "...", "d": "..."},
        "user_choice": "A",
        "correct_answer": "B",
        "solution": "The original textbook solution",
        "hack": "Whenever you see [X], the answer is always [Y]. Don't let option [Z] trick you."
      }
    }
  ]
}

--- SESSION_DATA ---
${JSON.stringify(sessionData, null, 2)}`;

    navigator.clipboard.writeText(prompt).then(() => {
      alert("Mastery Data & Diagnostic Prompt copied! Paste this into the AI Architect.");
    });
  };

  const importAIReview = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      const subject = data.subject || "AI Review";
      const route = data.route || [];

      const qList: Question[] = [];
      const hacks: Record<number, string> = {};

      route.forEach((step: any, idx: number) => {
        // Step Original
        const qOrig: Question = {
          id: step.original.id,
          q: step.original.question,
          options: step.original.options,
          a: step.original.correct_answer?.toUpperCase() || "A",
          yr: String(new Date().getFullYear()),
          section: `Mastery Step ${idx + 1}: ${step.topic} (${step.sub_topic || ''})`,
          isReviewable: true
        };
        qList.push(qOrig);
        hacks[qOrig.id] = step.original.hack;
      });

      setReviewQuestions(qList);
      setReviewHacks(hacks);
      setReviewAnswers({});
      setIsReview(false);
      setActiveSubjects([subject]);
      setQbState({ [subject]: qList });
      setCurSubIdx(0);
      setCurQIdx(0);
      setView('EXAM');
      setAiModalOpen(false);
    } catch (e) {
      alert("Failed to parse AI Review JSON. Please check the format.");
    }
  };

  const onReviewPerformance = () => {
    setIsReview(true);
    setReviewAnswers(answers);
    setResultModalOpen(false);
    setView('EXAM');
    setCurSubIdx(0);
    setCurQIdx(0);
  };

  const onNewSession = () => {
    setIsFinished(false);
    setExamStarted(false);
    setHasSavedSession(false);
    setResumePromptOpen(false);
    setResultModalOpen(false);
    setAnswers({});
    setChatHistories({});
    setTotalSecs(0);
    setCurSubIdx(0);
    setCurQIdx(0);
    setIsReview(false);
    setReviewAnswers({});
    setView('SETUP');
  };

  return (
    <div className="jamb-replica-root">
      {view === 'SETUP' ? (
        <div className="setup-wrapper-outer" style={{ minHeight: "100vh", background: "#f5f7f9" }}>
          <SetupScreen
            configs={configs}
            setConfigs={setConfigs}
            sessionMode={sessionMode}
            setSessionMode={setSessionMode}
            startExam={() => startExam()}
            startExamWithTime={(t) => startExam(t)}
            resumeExam={resumeExam}
            enterReview={() => setAiModalOpen(true)}
            hasSavedSession={hasSavedSession}
            isLoading={isLoading}
            fetchError={fetchError}
            availableSubjects={availableSubjects}
            availableCounts={availableCounts}
            isDataReady={isDataReady}
            candidateName={candidateName}
            setCandidateName={setCandidateName}
          />
        </div>
      ) : (
        <ExamInterface
          candidateName={candidateName}
          activeSubjects={activeSubjects}
          totalQuestionsCount={Object.keys(qbState).length > 0 ? Object.values(qbState).reduce((acc, qs) => acc + qs.length, 0) : totalQuestionsTotal}
          isExamMode={sessionMode === 'EXAM'}
          isPracticeMode={sessionMode === 'PRACTICE'}
          finalScore={finalScore}
          totalQuestions={Object.keys(qbState).length > 0 ? Object.values(qbState).reduce((acc, qs) => acc + qs.length, 0) : totalQuestionsTotal}
          jambScore={jambScore}
          breakdown={breakdown}
          curSubIdx={curSubIdx}
          curQIdx={curQIdx}
          setCurSubIdx={setCurSubIdx}
          setCurQIdx={setCurQIdx}
          switchSubject={switchSubject}
          navigate={navigate}
          jumpTo={jumpTo}
          currentSubject={currentSubject}
          currentQuestions={currentQuestions}
          currentQuestion={currentQuestion}
          currentKey={currentKey}
          answers={answers}
          setAnswers={setAnswers}
          totalSecs={totalSecs}
          formatTime={formatTime}
          openEndModal={() => setEndModalOpen(true)}
          toggleCalc={(rect?: DOMRect) => {
            if (rect) {
              setCalcPos({
                top: rect.bottom + window.scrollY + 5,
                left: Math.max(10, rect.left + window.scrollX - 80)
              });
            }
            setCalcOpen(!calcOpen);
          }}
          qbState={qbState}
          isReview={isReview}
          reviewAnswers={reviewAnswers}
          showSolutions={isReview || sessionMode === 'PRACTICE'}
          hacks={reviewHacks}
          chatHistories={chatHistories}
          setChatHistories={setChatHistories}
          onNewSession={onNewSession}
        />
      )}

      <Calculator
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        calcExpr={calcExpr}
        setCalcExpr={setCalcExpr}
        calcRef={calcRef}
        position={calcPos}
      />

      <Modals
        sessionMode={sessionMode}
        qbState={qbState}
        activeSubjects={activeSubjects}
        answers={answers}
        endModalOpen={endModalOpen}
        resultModalOpen={resultModalOpen}
        closeEndModal={() => setEndModalOpen(false)}
        submitExam={submitExam}
        totalAnswered={Object.keys(answers).length}
        totalQuestions={totalQuestionsTotal}
        finalScore={finalScore}
        jambScore={jambScore}
        breakdown={breakdown}
        copyDiagnosticData={copyDiagnosticData}
        resumePromptOpen={resumePromptOpen}
        onResumeSession={resumeExam}
        onClearSession={clearSession}
        onReview={onReviewPerformance}
        onNewSession={onNewSession}
        importAIReview={importAIReview}
        aiModalOpen={aiModalOpen}
        closeAiModal={() => setAiModalOpen(false)}
      />
    </div>
  );
}


