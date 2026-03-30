"use client";

import React from "react";
import { Question } from "./types";
import QuestionChat from "./QuestionChat";

interface ExamInterfaceProps {
  // Config/Info
  candidateName: string;
  activeSubjects: string[];
  totalQuestionsCount: number;
  isExamMode: boolean;
  // Score (shown in review mode header)
  finalScore?: number;
  totalQuestions?: number;
  jambScore?: number;
  breakdown?: string[];
  
  // Navigation State
  curSubIdx: number;
  curQIdx: number;
  setCurSubIdx: (i: number) => void;
  setCurQIdx: (i: number) => void;
  switchSubject: (i: number) => void;
  navigate: (dir: number) => void;
  jumpTo: (qi: number) => void;

  // Question State
  currentSubject: string;
  currentQuestions: Question[];
  currentQuestion: Question;
  currentKey: string;
  
  // User Actions
  answers: Record<string, string>;
  flags: Record<string, boolean>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setFlags: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  
  // Timer & Controls
  totalSecs: number;
  formatTime: (s: number) => string;
  openEndModal: () => void;
  toggleCalc: () => void;
  
  // Scoring
  qbState: Record<string, Question[]>;

  // Review Mode Props
  isReview?: boolean;
  reviewAnswers?: Record<string, string>;
  showSolutions?: boolean;
  hacks?: Record<number, string>;
  isPracticeMode?: boolean;
}

export default function ExamInterface({
  candidateName,
  activeSubjects,
  totalQuestionsCount,
  isExamMode,
  finalScore = 0,
  totalQuestions: totalQCount = 0,
  jambScore = 0,
  breakdown = [],
  curSubIdx,
  curQIdx,
  setCurSubIdx,
  setCurQIdx,
  switchSubject,
  navigate,
  jumpTo,
  currentSubject,
  currentQuestions,
  currentQuestion,
  currentKey,
  answers,
  flags,
  setAnswers,
  setFlags,
  totalSecs,
  formatTime,
  openEndModal,
  toggleCalc,
  qbState,
  isReview = false,
  reviewAnswers = {},
  showSolutions = false,
  hacks = {},
  isPracticeMode = false
}: ExamInterfaceProps) {
  // Helper to remove emojis from string
  const stripEmojis = (str: string) => {
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F093}\u{1F191}-\u{1F251}\u{2B50}]/gu, '');
  };
  
  // Derived Stats
  const key = (sIdx: number, qIdx: number) => `${sIdx}-${qIdx}`;
  const currentSubAnsweredCount = currentQuestions.filter((_, i) => answers[key(curSubIdx, i)]).length;
  const currentSubFlaggedCount = currentQuestions.filter((_, i) => flags[key(curSubIdx, i)]).length;
  const progressPct = Math.round((currentSubAnsweredCount / (currentQuestions.length || 1)) * 100);
  const validOptions = Object.entries(currentQuestion?.options || {})
    .filter(([_, text]) => text && String(text).trim() !== "")
    .map(([letter]) => letter.toUpperCase());

  // In review mode, use reviewAnswers if provided
  const effectiveAnswers = isReview ? reviewAnswers : answers;
  const hasAnsweredCurrent = !!answers[currentKey];
  
  // In Practice mode: reveal answer+solution as soon as the user picks an option
  const showSolutionNow = isReview || (isPracticeMode && hasAnsweredCurrent) || currentQuestion.isReviewable;
  
  // Options are interactive only if not reviewing AND (not practice mode OR hasn't answered yet)
  const areOptionsInteractive = !isReview && !currentQuestion.isReviewable && !(isPracticeMode && hasAnsweredCurrent);

  return (
    <div className="jamb-replica-root">
      <div className="jamb-header">
        <div className="jamb-logo">
          <div className="jamb-logo-circle">JAMB</div>
          <div className="jamb-logo-text">
            <strong>UTME 2026</strong>
            Unified Tertiary Matriculation Examination
          </div>
        </div>

        {/* Score Banner — shown in header during review */}
        {isReview && finalScore !== undefined && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            flex: 1,
            justifyContent: "center",
            padding: "4px 20px",
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: "50px",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            margin: "0 15px",
            minWidth: "fit-content"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#fff", lineHeight: 1 }}>
                {finalScore}<span style={{ fontSize: "12px", opacity: 0.7 }}>/{totalQCount}</span>
              </div>
              <div style={{ fontSize: "9px", color: "#aad4ee", fontWeight: "800", textTransform: "uppercase", marginTop: "2px" }}>CORRECT</div>
            </div>
            
            <div style={{ width: "1px", height: "24px", background: "rgba(255, 255, 255, 0.2)" }} />
            
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: "900", color: "#4ade80", lineHeight: 1 }}>{jambScore}</div>
              <div style={{ fontSize: "9px", color: "#aad4ee", fontWeight: "800", textTransform: "uppercase", marginTop: "2px" }}>JAMB SCORE</div>
            </div>
            
            <div style={{ width: "1px", height: "24px", background: "rgba(255, 255, 255, 0.2)" }} />
            
            <div style={{ fontSize: "11px", color: "white", fontWeight: "600", letterSpacing: "0.3px" }}>
              {breakdown.map(b => <div key={b}>{b}</div>)}
            </div>

            <button
              onClick={() => window.location.reload()}
              style={{ 
                padding: "8px 16px", 
                background: "#facc15", 
                color: "#1e3a8a", 
                border: "none", 
                borderRadius: "20px", 
                fontSize: "12px", 
                fontWeight: "800", 
                cursor: "pointer", 
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "transform 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              New Session
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
          {isExamMode && !isReview && (
            <div className="timer-box">
              <div className="timer-label">Time Remaining</div>
              <div className={`timer-value ${totalSecs < 300 ? "urgent" : ""}`} id="timer">
                {formatTime(totalSecs)}
              </div>
            </div>
          )}
          {!isReview && <button className="end-btn" onClick={openEndModal}>End Exam</button>}
        </div>
      </div>

      <div className="info-bar">
        <span>UTME — 2026 | {totalQuestionsCount} Questions | {activeSubjects.length} Subjects</span>
        {isReview ? (
          <span style={{ color: "#cc8800", fontWeight: "bold" }}>REVIEW MODE — Navigation Only</span>
        ) : (
          <span>{isExamMode ? "Exam mode" : "Practice mode"} | Keys: {validOptions.join(' ')} | N (next) | P (prev)</span>
        )}
      </div>

      <div className="subject-tabs">
        {activeSubjects.map((s, i) => {
          const qs = qbState[s] || [];
          const done = qs.filter((_, qi) => answers[key(i, qi)]).length;
          return (
            <div
              key={s}
              className={`subject-tab ${i === curSubIdx ? "active" : ""}`}
              onClick={() => switchSubject(i)}
            >
              {s} ({done}/{qs.length})
            </div>
          );
        })}
      </div>

      <div className="exam-body">
        <div className="question-panel">
          <div className="q-header">
            <span className="q-number-badge">
              Question {curQIdx + 1} of {currentQuestions.length} — {currentSubject} ({currentQuestion.yr})
            </span>
            {!isReview && !currentQuestion.isReviewable && !(isPracticeMode && hasAnsweredCurrent) && (
              <button
                className={`flag-btn ${flags[currentKey] ? "flagged" : ""}`}
                onClick={() => setFlags((prev) => ({ ...prev, [currentKey]: !prev[currentKey] }))}
              >
                {flags[currentKey] ? "⚑ Flagged" : "⚑ Flag for Review"}
              </button>
            )}
          </div>

          <div className={currentQuestion.hasPassage === 1 ? "split-screen" : "single-column"}>
            {currentQuestion.hasPassage === 1 && (
              <div className="passage-container">
                <div className="passage-header">Reading Passage</div>
                <div 
                  className="passage-content whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.section || "" }}
                />
              </div>
            )}

            <div className={currentQuestion.hasPassage === 1 ? "question-content" : "q-body-container"}>
              {/* Context/Section Header (Only if not split-screen and section exists) */}
              {currentQuestion.hasPassage !== 1 && currentQuestion.section && currentQuestion.section !== currentQuestion.q && (
                <div 
                  className="section-header whitespace-pre-wrap"
                  style={{ 
                    fontSize: "13px", 
                    fontStyle: "italic", 
                    color: "#666", 
                    background: "#f0f7ff", 
                    padding: "10px", 
                    marginBottom: "15px", 
                    borderLeft: "4px solid #003366",
                    borderRadius: "0 4px 4px 0"
                  }}
                  dangerouslySetInnerHTML={{ __html: currentQuestion.section }}
                />
              )}

              <div 
                className="q-text whitespace-pre-wrap"
                style={{ fontWeight: "600", marginBottom: "20px" }}
                dangerouslySetInnerHTML={{ 
                  __html: currentQuestion.q || (currentQuestion.hasPassage === 1 ? "" : currentQuestion.section) || "No question text available." 
                }}
              />

              {currentQuestion.image && (
                <div style={{ marginBottom: "20px" }}>
                  <img 
                    src={currentQuestion.image} 
                    alt="Question visual" 
                    className="max-w-full h-auto my-4 rounded border"
                    style={{ display: "block", maxWidth: "100%", height: "auto" }}
                  />
                </div>
              )}
              
              <div className="options">
                {Object.entries(currentQuestion.options || {})
                  .filter(([_, text]) => text && String(text).trim() !== "")
                  .map(([letter, text]) => {
                    const upperLetter = letter.toUpperCase();
                    const isSelected = effectiveAnswers[currentKey] === upperLetter;
                    const isCorrect = currentQuestion.a === upperLetter;
                    
                    let statusClass = "";
                    if (showSolutionNow) {
                      if (isCorrect) statusClass = "correct-opt";
                      else if (isSelected) statusClass = "incorrect-opt";
                    } else if (isSelected) {
                      statusClass = "selected";
                    }

                    return (
                      <div
                        key={letter}
                        className={`option-row ${statusClass}`}
                        onClick={() => areOptionsInteractive && setAnswers((prev) => ({ ...prev, [currentKey]: upperLetter }))}
                        style={{ cursor: areOptionsInteractive ? "pointer" : "default" }}
                      >
                        <div className="option-letter">{upperLetter}</div>
                        <div 
                          className="option-text" 
                          dangerouslySetInnerHTML={{ __html: text }}
                        />
                        {showSolutionNow && isCorrect && <span style={{ marginLeft: "auto", color: "#166534", fontWeight: "bold" }}>● Correct Answer</span>}
                        {showSolutionNow && isSelected && !isCorrect && <span style={{ marginLeft: "auto", color: "#991b1b", fontWeight: "bold" }}>✕ Your Choice</span>}
                      </div>
                    );
                  })}
              </div>

              {/* Solution / Hack Section */}
              {showSolutionNow && (showSolutions || hacks[currentQuestion.id] || currentQuestion.solution) && (
                <div style={{ marginTop: "30px", padding: "20px", background: "#f0f7ff", borderRadius: "12px", border: "1px solid #003366" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "900", color: "#003366", textTransform: "uppercase", background: "white", padding: "4px 10px", borderRadius: "20px", border: "1px solid #003366" }}>
                      {hacks[currentQuestion.id] ? "💡 SPEED HACK" : "📖 EXPLANATION"}
                    </span>
                  </div>
                  <div 
                    className="whitespace-pre-wrap"
                    style={{ fontSize: "15px", lineHeight: "1.6", color: "#003366", fontWeight: "600" }}
                    dangerouslySetInnerHTML={{ __html: stripEmojis(hacks[currentQuestion.id] || currentQuestion.solution || "No explanation provided.") }}
                  />
                </div>
              )}

              {/* AI Tutor Chat — shown whenever solution is revealed */}
              {showSolutionNow && (
                <QuestionChat
                  candidateName={candidateName}
                  questionId={currentQuestion.id}
                  questionContext={`QUESTION: ${currentQuestion.q}\n\nOPTIONS:\n${Object.entries(currentQuestion.options || {}).map(([k, v]) => `${k.toUpperCase()}) ${v}`).join('\n')}\n\nCORRECT ANSWER: ${currentQuestion.a}\n\nEXPLANATION: ${currentQuestion.solution || 'Not available.'}`}
                />
              )}
            </div>
          </div>
          <div className="nav-row">
            <button
              className="nav-btn"
              onClick={() => navigate(-1)}
              disabled={curSubIdx === 0 && curQIdx === 0}
            >
              Previous
            </button>
            <button
              className="nav-btn primary"
              onClick={() => navigate(1)}
            >
              {curSubIdx === activeSubjects.length - 1 && curQIdx === currentQuestions.length - 1 ? "Finish" : "Next"}
            </button>
            <button className="calc-btn" onClick={toggleCalc}>Calculator</button>
          </div>
        </div>

        <div className="navigator-panel">
          <div className="nav-panel-title">Question Navigator</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
          <div className="score-row">
            <span>{currentSubAnsweredCount} answered</span>
            <span>{currentSubFlaggedCount} flagged</span>
          </div>
          <div className="q-grid">
            {currentQuestions.map((q, i) => {
              const k = key(curSubIdx, i);
              const ans = effectiveAnswers[k];
              let cls = "q-bubble";
              
              if (showSolutionNow || isReview) {
                if (ans === q.a) cls += " correct-q";
                else if (ans) cls += " incorrect-q";
              } else {
                if (answers[k]) cls += " answered";
                else if (flags[k]) cls += " flagged-q";
              }
              
              if (i === curQIdx) cls += " current";
              return (
                <div key={i} className={cls} onClick={() => jumpTo(i)}>
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div className="legend">
            <div className="legend-row"><div className="legend-dot ans"></div> Answered</div>
            <div className="legend-row"><div className="legend-dot flg"></div> Flagged</div>
            <div className="legend-row"><div className="legend-dot una"></div> Not Attempted</div>
          </div>
        </div>
      </div>
    </div>
  );
}
