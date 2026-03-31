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
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // Timer & Controls
  totalSecs: number;
  formatTime: (s: number) => string;
  openEndModal: () => void;
  toggleCalc: () => void;

  // Scoring
  qbState: Record<string, Question[]>;

  // Chat Persistence
  chatHistories: Record<number, any[]>;
  setChatHistories: React.Dispatch<React.SetStateAction<Record<number, any[]>>>;

  // Review Mode Props
  isReview?: boolean;
  reviewAnswers?: Record<string, string>;
  showSolutions?: boolean;
  hacks?: Record<number, string>;
  isPracticeMode?: boolean;
  onNewSession?: () => void;
  // Reporting
  onReportIssue?: (report: { id: number, subject: string, type: string, comment: string }) => void;
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
  setAnswers,
  totalSecs,
  formatTime,
  openEndModal,
  toggleCalc,
  qbState,
  chatHistories,
  setChatHistories,
  isReview = false,
  reviewAnswers = {},
  showSolutions = false,
  hacks = {},
  isPracticeMode = false,
  onNewSession = () => window.location.reload()
}: ExamInterfaceProps) {
  const [reportModalOpen, setReportModalOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState("Wrong Answer");
  const [reportComment, setReportComment] = React.useState("");
  const [isReporting, setIsReporting] = React.useState(false);

  const handleReportSubmit = async () => {
    setIsReporting(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "report",
          name: candidateName,
          detail: {
            id: currentQuestion.id,
            subject: currentSubject,
            type: reportType,
            comment: reportComment
          }
        })
      });
      alert("Report sent! Thank you for helping us stay accurate.");
      setReportModalOpen(false);
      setReportComment("");
    } catch (e) {
      alert("Failed to send report. Please try again.");
    } finally {
      setIsReporting(false);
    }
  };

  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [feedbackType, setFeedbackType] = React.useState("❤️ Testimonial / Praise");
  const [feedbackComment, setFeedbackComment] = React.useState("");
  const [isSendingFeedback, setIsSendingFeedback] = React.useState(false);

  const handleFeedbackSubmit = async () => {
    setIsSendingFeedback(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "feedback",
          name: candidateName,
          detail: { type: feedbackType, comment: feedbackComment }
        })
      });
      alert("Feedback received! Thank you for your support.");
      setFeedbackOpen(false);
      setFeedbackComment("");
    } catch (e) {
      alert("Failed to send feedback. Please try again.");
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const showSolutionNow = isReview || (isPracticeMode && !!answers[currentKey]) || currentQuestion.isReviewable;

  // Snap to top ONLY when the question ID actually changes (avoids scrolling on option clicks)
  const lastQId = React.useRef<number>(currentQuestion.id);
  React.useEffect(() => {
    if (lastQId.current !== currentQuestion.id) {
      document.getElementById("q-panel-top")?.scrollIntoView({ behavior: "instant", block: "start" });
      lastQId.current = currentQuestion.id;
    }
  }, [currentQuestion.id]);

  // Ref to AI chat section for smooth scrolling
  const aiSectionRef = React.useRef<HTMLDivElement>(null);
  const scrollToAI = () => {
    aiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Helper to remove emojis from string
  const stripEmojis = (str: string) => {
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F093}\u{1F191}-\u{1F251}\u{2B50}]/gu, '');
  };

  // Derived Stats
  const key = (sIdx: number, qIdx: number) => `${sIdx}-${qIdx}`;
  const currentSubAnsweredCount = currentQuestions.filter((_, i) => answers[key(curSubIdx, i)]).length;
  const progressPct = Math.round((currentSubAnsweredCount / (currentQuestions.length || 1)) * 100);
  const validOptions = Object.entries(currentQuestion?.options || {})
    .filter(([_, text]) => text && String(text).trim() !== "")
    .map(([letter]) => letter.toUpperCase());

  // In review mode, use reviewAnswers if provided
  const effectiveAnswers = isReview ? reviewAnswers : answers;
  const hasAnsweredCurrent = !!answers[currentKey];

  // In Practice mode: reveal answer+solution as soon as the user picks an option

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

        {/* Score Banner — premium glassmorphism redesign */}
        {(isReview || (isPracticeMode && Object.keys(answers).length >= totalQuestionsCount)) && finalScore !== undefined && (
          <div className="review-banner-container" style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flex: 1,
            justifyContent: "center",
            padding: "4px 8px",
            margin: "0 10px",
            minWidth: "fit-content"
          }}>
            {/* The Glass Vault */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              padding: "6px 24px",
              borderRadius: "40px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              gap: "24px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)"
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#fff", lineHeight: 1 }}>
                  {finalScore}<span style={{ fontSize: "12px", opacity: 0.7 }}>/{totalQuestionsCount}</span>
                </div>
                <div style={{ fontSize: "9px", color: "#aad4ee", fontWeight: "900", textTransform: "uppercase", marginTop: "2px", letterSpacing: "0.5px" }}>CORRECT</div>
              </div>

              <div style={{ width: "1px", height: "28px", background: "rgba(255, 255, 255, 0.2)" }} />

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "22px", fontWeight: "900", color: "#4ade80", lineHeight: 1 }}>{jambScore}</div>
                <div style={{ fontSize: "9px", color: "#aad4ee", fontWeight: "900", textTransform: "uppercase", marginTop: "2px", letterSpacing: "0.5px" }}>JAMB SCORE</div>
              </div>

              {breakdown.length > 0 && (
                <>
                  <div style={{ width: "1px", height: "28px", background: "rgba(255, 255, 255, 0.2)" }} />
                  <div style={{
                    fontSize: "11px",
                    color: "white",
                    fontWeight: "700",
                    lineHeight: "1.3",
                    textAlign: "left",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    maxHeight: "36px",
                    overflowY: "auto",
                    paddingRight: "8px"
                  }} className="breakdown-list">
                    {breakdown.map(b => (
                      <div key={b} style={{ whiteSpace: "nowrap" }}>
                        <span style={{ opacity: 0.7 }}>{b.split(': ')[0]}:</span> {b.split(': ')[1]}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={onNewSession}
                style={{
                  padding: "10px 24px",
                  background: "#facc15",
                  color: "#1e3a8a",
                  border: "none",
                  borderRadius: "30px",
                  fontSize: "13px",
                  fontWeight: "900",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  boxShadow: "0 4px 12px rgba(250, 204, 21, 0.4)",
                  transition: "all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05) translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(250, 204, 21, 0.6)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(250, 204, 21, 0.4)";
                }}
              >
                New Session
              </button>
            </div>
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
          {!isReview && (
            <button className="end-btn" onClick={openEndModal}>
              {isExamMode ? "End Exam" : "Exit Session"}
            </button>
          )}
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

      <div className="exam-body" style={{ scrollMarginTop: "80px" }}>
        <div className="question-panel" id="q-panel-top">
          <div className="q-header">
            <div className="q-header-top-row">
              <span className="q-number-badge">
                Question {curQIdx + 1} of {currentQuestions.length} — {currentSubject} ({currentQuestion.yr})
              </span>
            </div>
            <div className="q-header-bottom-row">
              <button 
                className="calc-btn" 
                onClick={() => navigate(-1)} 
                disabled={curSubIdx === 0 && curQIdx === 0}
                style={{ padding: "6px 14px", fontWeight: "800" }}
              >
                Previous
              </button>
              <button 
                className="calc-btn primary-nav-top" 
                onClick={() => navigate(1)}
                style={{ 
                  padding: "6px 14px", 
                  fontWeight: "800", 
                  background: "#003366", 
                  color: "white", 
                  border: "none",
                  borderRadius: "18px"
                }}
              >
                {curSubIdx === activeSubjects.length - 1 && curQIdx === currentQuestions.length - 1
                  ? (isExamMode ? "Finish" : "Exit Session")
                  : curQIdx === currentQuestions.length - 1 && curSubIdx < activeSubjects.length - 1
                    ? `${activeSubjects[curSubIdx + 1]}`
                    : "Next"}
              </button>
              <button className="calc-btn" onClick={toggleCalc} style={{ padding: "6px 12px", border: "1px solid #c8d8f0", background: "#f8fafc", borderRadius: "18px", fontSize: "12px", fontWeight: "600", color: "#003366", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="14" /><line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="8" y1="18" x2="8" y2="18" /><line x1="12" y1="18" x2="12" y2="18" /><line x1="16" y1="18" x2="16" y2="18" /></svg>
                <span className="desktop-only" style={{ fontSize: "12px", fontWeight: "700" }}>Calculator</span>
              </button>
            </div>
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
                style={{ fontWeight: "600", marginBottom: "20px", fontSize: "17px", lineHeight: "1.6" }}
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
                        style={{
                          cursor: areOptionsInteractive ? "pointer" : "default",
                          alignItems: "center",
                          position: "relative" // For potential absolute positioning if needed, or just container logic
                        }}
                      >
                        <div className="option-letter">{upperLetter}</div>
                        <div
                          className="option-text"
                          style={{ fontSize: "15px", fontWeight: "600" }}
                          dangerouslySetInnerHTML={{ __html: text }}
                        />
                        <div className="option-status-container" style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
                          {showSolutionNow && isCorrect && <span className="option-badge badge-correct">● Correct Answer</span>}
                          {showSolutionNow && isSelected && !isCorrect && <span className="option-badge badge-wrong">✕ Your Choice</span>}

                          {/* NEW: Contextual Ask AI Button */}
                          {showSolutionNow && isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                scrollToAI();
                              }}
                              className="ask-ai-tiny-btn"
                            >
                              Ask AI
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Solution / Hack Section */}
              {showSolutionNow && (showSolutions || hacks[currentQuestion.id] || currentQuestion.solution) && (
                <div style={{ marginTop: "30px", padding: "20px", background: "#f0f7ff", borderRadius: "12px", border: "1px solid #003366", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "900", color: "#003366", textTransform: "uppercase", background: "white", padding: "4px 10px", borderRadius: "20px", border: "1px solid #003366" }}>
                      {hacks[currentQuestion.id] ? "💡 SPEED HACK" : "EXPLANATION"}
                    </span>
                    <button
                      onClick={() => setReportModalOpen(true)}
                      style={{ background: "none", border: "none", color: "#ef4444", fontSize: "11px", fontWeight: "800", cursor: "pointer", textDecoration: "underline" }}
                    >
                      🚩 Report Issue with this Question
                    </button>
                  </div>
                  <div
                    className="whitespace-pre-wrap"
                    style={{ fontSize: "15px", lineHeight: "1.6", color: "#003366", fontWeight: "600" }}
                    dangerouslySetInnerHTML={{ __html: stripEmojis(hacks[currentQuestion.id] || currentQuestion.solution || "No explanation provided.") }}
                  />
                </div>
              )}

              {/* AI Tutor Chat — shown when user explicitly scrolls to it */}
              {showSolutionNow && (
                <div ref={aiSectionRef}>
                  <QuestionChat
                    candidateName={candidateName}
                    questionId={currentQuestion.id}
                    questionContext={JSON.stringify({
                      s: currentSubject,
                      q: currentQuestion.q,
                      o: currentQuestion.options,
                      a: currentQuestion.a,
                      sol: currentQuestion.solution
                    })}
                    history={chatHistories[currentQuestion.id] || []}
                    onUpdateMessages={(newMsgs) => setChatHistories(prev => ({ ...prev, [currentQuestion.id]: newMsgs }))}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="nav-row">
            <button
              className="nav-btn"
              onClick={() => navigate(-1)}
              disabled={curSubIdx === 0 && curQIdx === 0}
            >
              {curQIdx === 0 && curSubIdx > 0
                ? `← ${activeSubjects[curSubIdx - 1]}`
                : "Previous"}
            </button>


            <button
              className="nav-btn primary"
              onClick={() => navigate(1)}
            >
              {curSubIdx === activeSubjects.length - 1 && curQIdx === currentQuestions.length - 1
                ? (isExamMode ? "Finish" : "Exit Session")
                : curQIdx === currentQuestions.length - 1 && curSubIdx < activeSubjects.length - 1
                  ? `${activeSubjects[curSubIdx + 1]} →`
                  : "Next"}
            </button>
          </div>
        </div>

        <div className="navigator-panel" style={{ alignSelf: "flex-start" }}>
          <div className="nav-panel-title">Question Navigator</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }}></div>
          </div>
          <div className="score-row">
            <span>{currentSubAnsweredCount} answered</span>
            <span>{currentQuestions.length - currentSubAnsweredCount} untouched</span>
          </div>
          <div className="q-grid">
            {currentQuestions.map((q, i) => {
              const k = key(curSubIdx, i);
              const ans = effectiveAnswers[k];
              let cls = "q-bubble";

              const shouldShowStatus = isReview || currentQuestion.isReviewable || (isPracticeMode && !!ans);

              if (shouldShowStatus) {
                if (ans === q.a) cls += " correct-q";
                else if (ans) cls += " incorrect-q";
              } else {
                if (answers[k]) cls += " answered";
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
            {isExamMode && !isReview && (
              <div className="legend-row"><div className="legend-dot ans"></div> Answered</div>
            )}
            {(isPracticeMode || isReview) && (
              <>
                <div className="legend-row"><div className="legend-dot" style={{ background: "#22c55e", borderColor: "#16a34a" }}></div> Correct</div>
                <div className="legend-row"><div className="legend-dot" style={{ background: "#ef4444", borderColor: "#dc2626" }}></div> Incorrect</div>
              </>
            )}
            <div className="legend-row"><div className="legend-dot una"></div> Not Attempted</div>
          </div>

          {/* Desktop Version: Send Feedback Button (Repurposed from New Session) */}
          <div className="desktop-only" style={{ marginTop: "40px", paddingTop: "0" }}>
            <p style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "900", color: "#003366", textAlign: "center" }}>
              Enjoying the AI Tutor? Help us build the perfect prep tool! 🚀
            </p>
            <button 
              className="nav-btn primary" 
              onClick={() => setFeedbackOpen(true)} 
              style={{ width: "100%", padding: "14px", fontSize: "14.5px", fontWeight: "900", textTransform: "uppercase" }}
            >
              Send Feedback
            </button>
          </div>
        </div>

        {/* Mobile Version: Extreme Bottom Feedback Button */}
        <div className="mobile-only" style={{ width: "100%", background: "#f0f7ff", padding: "20px 16px", borderTop: "2px dashed #00336633", marginTop: "auto" }}>
          <p style={{ margin: "0 0 15px 0", fontSize: "13px", fontWeight: "800", color: "#003366", textAlign: "center" }}>
            Enjoying the AI Tutor? Help us build the perfect prep tool! 🚀
          </p>
          <button 
            className="nav-btn primary" 
            onClick={() => setFeedbackOpen(true)} 
            style={{ width: "100%", padding: "14px", fontSize: "14.5px", fontWeight: "900", textTransform: "uppercase" }}
          >
            Send Feedback
          </button>
        </div>
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="modal-bg open">
          <div className="modal-box" style={{ textAlign: "left" }}>
            <h3>Report Question Error</h3>
            <p>Help us maintain 100% accuracy for JAMB Prep 2026. What's wrong with this question?</p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Issue Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: "600" }}
              >
                <option>Wrong Answer</option>
                <option>Typo in Question/Options</option>
                <option>Broken Image</option>
                <option>AI Explanation is Wrong</option>
                <option>Other</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Comments (Optional)</label>
              <textarea
                placeholder="Explain the error briefly..."
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", minHeight: "80px", fontSize: "14px", fontWeight: "500" }}
              />
            </div>

            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setReportModalOpen(false)}>Cancel</button>
              <button
                className="modal-confirm"
                style={{ background: "#003366" }}
                onClick={handleReportSubmit}
                disabled={isReporting}
              >
                {isReporting ? "Sending..." : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div className="modal-bg open">
          <div className="modal-box" style={{ textAlign: "left" }}>
            <h3>Share Your Experience</h3>
            <p>Your feedback helps us build the best JAMB Prep tool for Nigerian students. What's on your mind?</p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Feedback Category</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value)}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: "600" }}
              >
                <option>🚀 Feature Request</option>
                <option>🎨 Design/UI Suggestion</option>
                <option>🐞 General Bug</option>
                <option>❤️ Testimonial / Praise</option>
                <option>Other</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase", marginBottom: "8px" }}>Details</label>
              <textarea
                placeholder="Tell us more..."
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", minHeight: "100px", fontSize: "14px", fontWeight: "500" }}
              />
            </div>

            <div className="modal-btns">
              <button className="modal-cancel" onClick={() => setFeedbackOpen(false)}>Cancel</button>
              <button
                className="modal-confirm"
                style={{ background: "#003366" }}
                onClick={handleFeedbackSubmit}
                disabled={isSendingFeedback || !feedbackComment.trim()}
              >
                {isSendingFeedback ? "Sending..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
