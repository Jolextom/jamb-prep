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

export default function JambReplica() {
  // Navigation State
  const [view, setView] = useState<'SETUP' | 'EXAM' | 'REVIEW'>('SETUP');
  
  // Setup States
  const [examStarted, setExamStarted] = useState(false);
  const [configs, setConfigs] = useState<SubjectConfigs>(() => {
    const initial: SubjectConfigs = {};
    SUBJECT_METADATA.forEach((m) => {
      initial[m.name] = { selected: false, count: 10 };
    });
    return initial;
  });
  const [sessionMode, setSessionMode] = useState<'EXAM' | 'PRACTICE'>('PRACTICE');

  // Exam States
  const [activeSubjects, setActiveSubjects] = useState<string[]>([]);
  const [curSubIdx, setCurSubIdx] = useState(0);
  const [curQIdx, setCurQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [fullPool, setFullPool] = useState<Question[]>([]); // For context injection
  const [totalSecs, setTotalSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // API State
  const [isLoading, setIsLoading] = useState(false);
  const [qbState, setQbState] = useState<Record<string, Question[]>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  // Calculator states
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpr, setCalcExpr] = useState("0");
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const calcRef = useRef<HTMLDivElement>(null);

  const key = useCallback((sIdx: number, qIdx: number) => `${sIdx}-${qIdx}`, []);

  const totalQuestionsTotal = Object.entries(configs)
    .filter(([_, c]) => c.selected)
    .reduce((acc, [_, c]) => acc + c.count, 0);

  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [availableCounts, setAvailableCounts] = useState<Record<string, number>>({});
  const [isDataReady, setIsDataReady] = useState(false);
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
        configs
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
              if (counts[name] && next[name].count > counts[name]) {
                next[name].count = counts[name];
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
  const startExam = async () => {
    const selected = Object.entries(configs)
      .filter(([name, c]) => c.selected && availableSubjects.includes(name))
      .map(([name]) => name);

    if (selected.length === 0) {
      alert("Please select at least one available subject.");
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    const newQB: Record<string, Question[]> = {};

    try {
      for (const subjectName of selected) {
        const metadata = SUBJECT_METADATA.find(m => m.name === subjectName);
        const config = configs[subjectName];
        if (!metadata || !config) continue;

        const res = await fetch(`/data/${metadata.slug}.json`);
        if (!res.ok) {
          throw new Error(`Could not load local data for ${subjectName}`);
        }

        const allQuestions: any[] = await res.json();
        
        // 2. TRUE RANDOMIZATION with Fisher-Yates
        const shuffled = fisherYatesShuffle(allQuestions);
        const picked = shuffled.slice(0, Math.min(config.count, shuffled.length));

        newQB[subjectName] = picked.map(item => ({
          id: item.id || 0,
          q: item.question || item.q || "",
          options: item.options || item.option || (Array.isArray(item.opts) ? Object.fromEntries(item.opts.map((o: string) => [o.substring(0,1).toLowerCase(), o.substring(3)])) : {}),
          a: (item.answer || "a").substring(0, 1).toUpperCase(),
          yr: String(item.examyear || 2025),
          topic: item.topic || "",
          sub_topic: item.sub_topic || "",
          difficulty: item.difficulty || "Moderate",
          solution: item.solution || "",
          section: item.section || "",
          image: item.image || "",
          hasPassage: item.hasPassage || 0,
          questionNub: item.questionNub || null
        }));
      }

      setQbState(newQB);
      setActiveSubjects(selected);
      
      if (sessionMode === 'EXAM') {
        setTotalSecs(totalQuestionsTotal * 40); // 40s per question for Exam
        setTimerRunning(true);
      } else {
        setTotalSecs(0); // Unlimited time for Practice
        setTimerRunning(false);
      }

      setFetchError(null);
      setView('EXAM');
      setExamStarted(true);
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
    setResultModalOpen(true);
    localStorage.removeItem("jamb_prep_session");
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
      if (!examStarted || resultModalOpen || endModalOpen || isLoading) return;
      const k = e.key.toUpperCase();
      
      // Dynamic Shortcut Logic: Only allow keys for which a valid option exists
      const validOptions = Object.entries(currentQuestion?.options || {})
        .filter(([_, text]) => text && String(text).trim() !== "")
        .map(([letter]) => letter.toUpperCase());

      if (validOptions.includes(k)) {
        setAnswers(p => ({ ...p, [currentKey]: k }));
      }
      if (k === "N") navigate(1);
      if (k === "P") navigate(-1);
      if (k === "F") setFlags(p => ({ ...p, [currentKey]: !p[currentKey] }));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [curSubIdx, curQIdx, resultModalOpen, endModalOpen, isLoading, examStarted, navigate, currentKey]);

  // Click outside calculator
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
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

  return (
    <div className="jamb-replica-root">
      {view === 'SETUP' ? (
        <div style={{ minHeight: "100vh", background: "#f5f7f9", padding: "40px 20px" }}>
          <SetupScreen
            configs={configs}
            setConfigs={setConfigs}
            sessionMode={sessionMode}
            setSessionMode={setSessionMode}
            startExam={startExam}
            resumeExam={resumeExam}
            enterReview={() => setAiModalOpen(true)}
            hasSavedSession={hasSavedSession}
            isLoading={isLoading}
            fetchError={fetchError}
            availableSubjects={availableSubjects}
            availableCounts={availableCounts}
            isDataReady={isDataReady}
          />
        </div>
      ) : (
        <ExamInterface
          activeSubjects={activeSubjects}
          totalQuestionsCount={Object.keys(qbState).length > 0 ? Object.values(qbState).reduce((acc, qs) => acc + qs.length, 0) : totalQuestionsTotal}
          isExamMode={sessionMode === 'EXAM'}
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
          flags={flags}
          setAnswers={setAnswers}
          setFlags={setFlags}
          totalSecs={totalSecs}
          formatTime={formatTime}
          openEndModal={() => setEndModalOpen(true)}
          toggleCalc={() => setCalcOpen(!calcOpen)}
          qbState={qbState}
          isReview={isReview}
          reviewAnswers={reviewAnswers}
          showSolutions={isReview || sessionMode === 'PRACTICE'}
          isPracticeMode={sessionMode === 'PRACTICE'}
          hacks={reviewHacks}
        />
      )}

      <Calculator
        isOpen={calcOpen}
        onClose={() => setCalcOpen(false)}
        calcExpr={calcExpr}
        setCalcExpr={setCalcExpr}
        calcRef={calcRef}
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
        importAIReview={importAIReview}
        aiModalOpen={aiModalOpen}
        closeAiModal={() => setAiModalOpen(false)}
      />
    </div>
  );
}
