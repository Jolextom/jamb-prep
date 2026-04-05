"use client";

import React from "react";
import { SUBJECT_METADATA, SubjectConfigs } from "./types";

interface SetupScreenProps {
  configs: SubjectConfigs;
  setConfigs: React.Dispatch<React.SetStateAction<SubjectConfigs>>;
  sessionMode: 'EXAM' | 'PRACTICE';
  setSessionMode: (v: 'EXAM' | 'PRACTICE') => void;
  startExam: () => void;
  resumeExam: () => void;
  hasSavedSession: boolean;
  isLoading: boolean;
  fetchError: string | null;
  availableSubjects: string[];
  availableCounts: Record<string, number>;
  isDataReady: boolean;
  candidateName: string;
  candidateId: string;
  onOpenSessionFromHistory?: (sessionId: string) => void;
  setCandidateName: (v: string) => void;
  startExamWithTime?: (timeSecs: number) => void;
}

export default function SetupScreen({
  configs,
  setConfigs,
  sessionMode,
  setSessionMode,
  startExam,
  resumeExam,
  hasSavedSession,
  isLoading,
  fetchError,
  availableSubjects,
  availableCounts,
  isDataReady,
  candidateName,
  candidateId,
  onOpenSessionFromHistory,
  setCandidateName,
  startExamWithTime
}: SetupScreenProps) {

  const [timeModifier, setTimeModifier] = React.useState(1.0); // 1.0 = 100% time
  const [countDrafts, setCountDrafts] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    SUBJECT_METADATA.forEach((m) => {
      initial[m.name] = String(Math.min(10, m.fixedExamCount || 60));
    });
    return initial;
  });

  // Sync counts when mode is toggled
  React.useEffect(() => {
    setConfigs(prev => {
      const next = { ...prev };
      SUBJECT_METADATA.forEach(m => {
        if (next[m.name]) {
          if (sessionMode === 'EXAM' && m.fixedExamCount) {
            next[m.name] = { ...next[m.name], count: m.fixedExamCount };
          } else if (sessionMode === 'PRACTICE') {
            next[m.name] = { ...next[m.name], count: Math.min(10, m.fixedExamCount || 60) };
          }
        }
      });
      return next;
    });
    setCountDrafts(prev => {
      const next = { ...prev };
      SUBJECT_METADATA.forEach(m => {
        if (sessionMode === 'EXAM' && m.fixedExamCount) {
          next[m.name] = String(m.fixedExamCount);
        } else if (sessionMode === 'PRACTICE') {
          next[m.name] = String(Math.min(10, m.fixedExamCount || 60));
        }
      });
      return next;
    });
    // Reset time modifier when switching modes
    if (sessionMode === 'PRACTICE') setTimeModifier(1.0);
  }, [sessionMode, setConfigs]);

  const toggleSubject = (name: string) => {
    setConfigs((prev) => {
      const isSelected = prev[name].selected;
      return {
        ...prev,
        [name]: { ...prev[name], selected: !isSelected },
      };
    });
  };

  const updateCount = (name: string, count: number) => {
    const safeCount = Math.max(1, count || 1);
    setConfigs((prev) => ({
      ...prev,
      [name]: { ...prev[name], count: safeCount },
    }));
  };

  const getMaxCount = (name: string) => Math.min(availableCounts[name] || 60, 60);

  const updateCountDraft = (name: string, rawValue: string) => {
    if (rawValue.trim() === "") {
      setCountDrafts((prev) => ({
        ...prev,
        [name]: rawValue,
      }));
      setConfigs((prev) => ({
        ...prev,
        [name]: { ...prev[name], count: 0 },
      }));
      return;
    }

    const parsed = Number.parseInt(rawValue, 10);
    const maxVal = getMaxCount(name);
    const safeCount = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, maxVal)) : 1;

    setCountDrafts((prev) => ({
      ...prev,
      [name]: String(safeCount),
    }));
    updateCount(name, safeCount);
  };

  const commitCountDraft = (name: string) => {
    setCountDrafts((prev) => {
      const rawValue = prev[name] ?? "";
      if (rawValue.trim() !== "") {
        return prev;
      }

      updateCount(name, 1);
      return {
        ...prev,
        [name]: "1",
      };
    });
  };

  // Time Calculation
  // JAMB Standard: 180 questions in 120 minutes = ~40 seconds per question
  const baseSecondsPerQuestion = 40;
  const totalQuestions = Object.values(configs)
    .filter(c => c.selected)
    .reduce((acc, c) => acc + c.count, 0);

  const calculatedSeconds = Math.floor(totalQuestions * baseSecondsPerQuestion * timeModifier);
  const displayMins = Math.floor(calculatedSeconds / 60);

  const handleStart = () => {
    const selectedWithInvalidCount = Object.entries(configs).some(
      ([name, c]) => availableSubjects.includes(name) && c.selected && (!Number.isFinite(c.count) || c.count < 1)
    );
    if (selectedWithInvalidCount || totalQuestions < 1) {
      alert("Please choose at least 1 question for each selected subject.");
      return;
    }

    if (startExamWithTime) {
      startExamWithTime(calculatedSeconds);
    } else {
      startExam();
    }
  };

  // Only show subjects that have local JSON data
  const filteredSubjects = SUBJECT_METADATA.filter(m => availableSubjects.includes(m.name));

  const anySelected = Object.values(configs).some(c => c.selected);

  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [feedbackType, setFeedbackType] = React.useState("Feature Request");
  const [feedbackComment, setFeedbackComment] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sessionHistoryOpen, setSessionHistoryOpen] = React.useState(false);
  const [isLoadingSessionHistory, setIsLoadingSessionHistory] = React.useState(false);
  const [sessionHistoryError, setSessionHistoryError] = React.useState("");
  const [sessionHistorySummary, setSessionHistorySummary] = React.useState({
    totalItems: 0,
    sessionResults: 0,
    sessionStarts: 0,
    examResults: 0,
    practiceResults: 0,
  });
  const [sessionHistory, setSessionHistory] = React.useState<Array<{ title: string; summary: string; timestamp: string; subjects: string[]; sessionId?: string; status?: string }>>([]);
  const [hasSessionHistory, setHasSessionHistory] = React.useState(false);

  React.useEffect(() => {
    const cleanName = candidateName.trim();
    if (!cleanName) {
      setHasSessionHistory(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/session-history?name=${encodeURIComponent(cleanName)}&cid=${encodeURIComponent(candidateId)}&summaryOnly=1`);
        if (!res.ok) {
          setHasSessionHistory(false);
          return;
        }
        const data = await res.json();
        setHasSessionHistory(Number(data?.summary?.totalItems || 0) > 0);
      } catch {
        setHasSessionHistory(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [candidateName, candidateId]);

  const handleFeedbackSubmit = async () => {
    setIsSending(true);
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
    } catch {
      alert("Failed to send. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenSessionHistory = async () => {
    const cleanName = candidateName.trim();
    if (!cleanName) {
      alert("Please enter your candidate name first.");
      return;
    }

    setSessionHistoryOpen(true);
    setSessionHistoryError("");
    setIsLoadingSessionHistory(true);

    try {
      const res = await fetch(`/api/session-history?name=${encodeURIComponent(cleanName)}&cid=${encodeURIComponent(candidateId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Could not load session history.");
      }
      setSessionHistorySummary({
        totalItems: Number(data?.summary?.totalItems || 0),
        sessionResults: Number(data?.summary?.sessionResults || 0),
        sessionStarts: Number(data?.summary?.sessionStarts || 0),
        examResults: Number(data?.summary?.examResults || 0),
        practiceResults: Number(data?.summary?.practiceResults || 0),
      });
      setSessionHistory(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setSessionHistory([]);
      setSessionHistoryError(e instanceof Error ? e.message : "Could not load session history.");
    } finally {
      setIsLoadingSessionHistory(false);
    }
  };

  return (
    <div className="setup-wrapper" style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", minHeight: "100vh", padding: "0" }}>
      <div className="setup-container" style={{ maxWidth: "900px", width: "100%", margin: "0 auto", background: "white", borderRadius: "0", display: "flex", flexDirection: "column", minHeight: "100vh", boxShadow: "0 10px 30px rgba(0,0,0,0.1)" }}>

        {/* Fixed Top Header & Identity Section */}
        <div style={{ position: "sticky", top: 0, zIndex: 100, background: "white", borderBottom: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
          <div className="jamb-header" style={{ padding: "12px 16px" }}>
            <div className="jamb-logo">
              <div className="jamb-logo-circle" style={{ width: "30px", height: "30px", fontSize: "8px" }}>JAMB</div>
              <div className="jamb-logo-text" style={{ fontSize: "10px" }}>
                <strong>UTME 2026</strong>
              </div>
            </div>
          </div>

          <div className="setup-section-inner" style={{ padding: "16px 16px 20px 16px", background: "#f0f7ff" }}>
            <div style={{ maxWidth: "900px", margin: "0 auto", width: "100%", padding: "0 16px" }} className="mobile-zero-pad">
              <label style={{ display: "block", fontSize: "11px", fontWeight: "900", color: "#003366", textTransform: "uppercase", marginBottom: "8px" }}>
                Who is practicing? (Candidate Name)
              </label>
              <input
                type="text"
                placeholder="Candidate Name"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "2px solid #00336622",
                  fontSize: "14px",
                  fontWeight: "750",
                  outline: "none",
                  background: "white",
                  color: "#1e3a8a",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                }}
              />
            </div>
          </div>
        </div>

        <div className="setup-content" style={{ padding: "30px" }}>
          <div className="setup-grid" style={{ display: "grid", gap: "30px" }}>

            <div className="subjects-section" style={{ gridColumn: "1 / -1" }}>
              <h3 style={{ fontSize: "14px", textTransform: "uppercase", color: "#666", marginBottom: "15px", letterSpacing: "1px" }}>
                Select Subjects ({availableSubjects.length} available)
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "12px"
              }}>
                {filteredSubjects.length === 0 && !isDataReady && (
                  <div style={{ padding: "20px", color: "#888", fontStyle: "italic" }}>Detecting local question banks...</div>
                )}
                {filteredSubjects.map((s) => {
                  const conf = configs[s.name];
                  const isReady = s.isReady;
                  return (
                    <div
                      key={s.name}
                      className={`subject-config-card ${conf.selected ? 'selected' : ''} ${!isReady ? 'disabled' : ''}`}
                      style={{
                        padding: "8px 12px",
                        border: "1px solid #ddd",
                        borderRadius: "6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        background: !isReady ? "#f5f5f5" : (conf.selected ? "#f0f7ff" : "#fff"),
                        borderColor: !isReady ? "#eee" : (conf.selected ? "#003366" : "#ddd"),
                        opacity: !isReady ? 0.7 : 1,
                        cursor: !isReady ? "not-allowed" : "default"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input
                            type="checkbox"
                            checked={conf.selected}
                            disabled={!isReady}
                            onChange={() => isReady && toggleSubject(s.name)}
                            style={{ width: "18px", height: "18px", cursor: isReady ? "pointer" : "not-allowed" }}
                          />
                          <span style={{ fontWeight: "700", color: isReady ? "#333" : "#888" }}>{s.name}</span>
                        </div>
                        {!isReady && (
                          <span style={{ fontSize: "10px", background: "#eee", color: "#666", padding: "2px 6px", borderRadius: "10px", fontWeight: "bold" }}>
                            UNDER SANITIZATION
                          </span>
                        )}
                      </div>

                      {isReady && (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingLeft: "28px" }}>
                          <span style={{ fontSize: "12px", color: "#666" }}>Questions:</span>
                          <input
                            type="number"
                            min={1}
                            max={getMaxCount(s.name)}
                            value={countDrafts[s.name] ?? String(conf.count)}
                            disabled={sessionMode === 'EXAM'}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => e.currentTarget.select()}
                            onBlur={() => commitCountDraft(s.name)}
                            onChange={(e) => updateCountDraft(s.name, e.target.value)}
                            style={{
                              width: "60px",
                              padding: "4px",
                              borderRadius: "4px",
                              border: "1px solid #ccc",
                              background: sessionMode === 'EXAM' ? "#eee" : "#fff",
                              fontWeight: "bold"
                            }}
                            aria-label={`${s.name} question count`}
                            title={`Max allowed: ${getMaxCount(s.name)}`}
                          />
                          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>
                            Max: {getMaxCount(s.name)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mode-section" style={{
              display: "flex",
              flexDirection: "column",
              gap: "15px",
              alignItems: "center",
              gridColumn: "1 / -1",
              marginTop: "20px"
            }}>
              <div className="session-mode-card" style={{
                background: "#f9f9f9",
                padding: "20px",
                borderRadius: "12px",
                border: "1px dashed #00336644",
                width: "100%",
                maxWidth: "500px"
              }}>
                <h3 style={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase", color: "#003366", marginBottom: "12px", textAlign: "center", letterSpacing: "1px" }}>
                  Session Mode
                </h3>
                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                  <button
                    className={`nav-btn ${sessionMode === 'EXAM' ? 'primary' : ''}`}
                    onClick={() => setSessionMode('EXAM')}
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      padding: "12px",
                      boxShadow: sessionMode === 'EXAM' ? "0 4px 12px rgba(0,51,102,0.2)" : "none"
                    }}
                  >
                    EXAM MODE
                  </button>
                  <button
                    className={`nav-btn ${sessionMode === 'PRACTICE' ? 'primary' : ''}`}
                    onClick={() => setSessionMode('PRACTICE')}
                    style={{
                      flex: 1,
                      fontSize: "13px",
                      padding: "12px",
                      boxShadow: sessionMode === 'PRACTICE' ? "0 4px 12px rgba(0,51,102,0.2)" : "none"
                    }}
                  >
                    PRACTICE MODE
                  </button>
                </div>

                {sessionMode === 'EXAM' && (
                  <div style={{ padding: "15px", background: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "900", color: "#64748b", textTransform: "uppercase" }}>Challenge Level</span>
                      <span style={{ fontSize: "12px", fontWeight: "900", color: timeModifier < 1 ? "#ef4444" : "#003366" }}>
                        {timeModifier === 1 ? "STANDARD" : (timeModifier === 0.75 ? "FAST ⚡" : (timeModifier === 0.5 ? "ELITE 🔥" : "GOD MODE 🏆"))}
                      </span>
                    </div>

                    <div style={{ position: "relative", padding: "0 10px" }}>
                      <input
                        type="range"
                        min="0.25"
                        max="1.0"
                        step="0.25"
                        value={timeModifier}
                        onChange={(e) => setTimeModifier(parseFloat(e.target.value))}
                        style={{
                          width: "100%",
                          cursor: "pointer",
                          accentColor: "#003366",
                          height: "6px",
                          borderRadius: "3px"
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "10px", color: "#94a3b8", fontWeight: "700" }}>
                        <span>GOD</span>
                        <span>ELITE</span>
                        <span>FAST</span>
                        <span>STD</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "20px", paddingTop: "15px", borderTop: "2px solid #f1f5f9" }}>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Questions</div>
                        <div style={{ fontSize: "20px", fontWeight: "900", color: "#1e293b" }}>{totalQuestions}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: "800", textTransform: "uppercase" }}>Time Limit</div>
                        <div style={{ fontSize: "20px", fontWeight: "900", color: "#003366" }}>{displayMins} MINS</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {fetchError && (
                <div style={{ color: "#cc0000", background: "#fee", padding: "12px", borderRadius: "6px", fontSize: "13px", border: "1px solid #fcc" }}>
                  ⚠️ {fetchError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "500px" }}>
                <button
                  className="nav-btn primary"
                  onClick={handleStart}
                  disabled={isLoading || !candidateName.trim() || !anySelected || totalQuestions < 1}
                  style={{
                    padding: "18px",
                    fontSize: "18px",
                    fontWeight: "900",
                    letterSpacing: "1px",
                    boxShadow: "0 10px 20px rgba(0,51,102,0.15)"
                  }}
                >
                  {isLoading ? "PREPARING..." : "START NOW"}
                </button>
                <div style={{ display: "flex", gap: "10px" }}>
                  {hasSavedSession && (
                    <button className="nav-btn" onClick={resumeExam} style={{ flex: 1, background: "#059669", color: "white", padding: "12px" }}>
                      CONTINUE PREVIOUS
                    </button>
                  )}
                </div>
              </div>

              <div style={{ fontSize: "12px", color: "#555", background: "#f9f9f9", padding: "10px", borderRadius: "6px", border: "1px dashed #ccc" }}>
                {sessionMode === 'EXAM'
                  ? "Timed. Answers and solutions shown after you submit."
                  : "Untimed. See if your answer is correct immediately after each question."}
              </div>
            </div>

          </div>

          {/* Big Noticeable Feedback Section */}
          <div className="setup-feedback-footer" style={{
            marginTop: "40px",
            padding: "24px",
            background: "#f0f7ff",
            borderRadius: "16px",
            border: "2px dashed #00336633",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px"
          }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#003366" }}>
              Help us build the #1 JAMB tool!
            </h3>
            <button
              onClick={() => setFeedbackOpen(true)}
              style={{
                background: "#003366",
                color: "white",
                border: "none",
                padding: "14px 28px",
                borderRadius: "30px",
                fontSize: "14px",
                fontWeight: "900",
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(0, 51, 102, 0.2)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              Help us improve! Send feedback or request a feature
            </button>
            {hasSessionHistory && (
              <button
                onClick={handleOpenSessionHistory}
                style={{
                  background: "white",
                  color: "#003366",
                  border: "2px solid #00336655",
                  padding: "12px 24px",
                  borderRadius: "30px",
                  fontSize: "13px",
                  fontWeight: "900",
                  cursor: "pointer"
                }}
              >
                Check My Session History
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {feedbackOpen && (
        <div className="modal-bg open">
          <div className="modal-box" style={{ textAlign: "left" }}>
            <h3>Share Your Experience</h3>
            <p>Your feedback helps us build the best JAMB Prep tool for Nigerian students. What&apos;s on your mind?</p>

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
                disabled={isSending || !feedbackComment.trim()}
              >
                {isSending ? "Sending..." : "Submit Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {sessionHistoryOpen && (
        <div className="modal-bg open">
          <div className="modal-box" style={{ textAlign: "left" }}>
            <h3>My JAMB Session History</h3>
            <p>Recent score records for {candidateName.trim() || "your candidate name"}.</p>

            {!isLoadingSessionHistory && !sessionHistoryError && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginBottom: "10px" }}>
                <div style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>Results: {sessionHistorySummary.sessionResults}</div>
                <div style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>Exam: {sessionHistorySummary.examResults}</div>
                <div style={{ padding: "8px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>Practice: {sessionHistorySummary.practiceResults}</div>
              </div>
            )}

            {isLoadingSessionHistory && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", fontWeight: "700" }}>
                Loading your session history...
              </div>
            )}

            {!isLoadingSessionHistory && sessionHistoryError && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: "700" }}>
                {sessionHistoryError}
              </div>
            )}

            {!isLoadingSessionHistory && !sessionHistoryError && sessionHistory.length === 0 && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#475569", fontWeight: "600" }}>
                No session history found for this name yet.
              </div>
            )}

            {!isLoadingSessionHistory && !sessionHistoryError && sessionHistory.length > 0 && (
              <div style={{ display: "grid", gap: "10px", maxHeight: "320px", overflowY: "auto", marginTop: "8px" }}>
                {sessionHistory.map((item, idx) => (
                  <div key={`${item.timestamp}-${idx}`} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px", background: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "12px", color: "#003366" }}>{item.title}</strong>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>{item.timestamp || "Unknown time"}</span>
                    </div>
                    <p style={{ margin: 0, color: "#1e293b", fontSize: "13px", lineHeight: 1.45 }}>{item.summary || "(No details available)"}</p>
                    {item.subjects && item.subjects.length > 0 && (
                      <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "12px", lineHeight: 1.35 }}>
                        Subjects: {item.subjects.join(", ")}
                      </p>
                    )}
                    {item.sessionId && onOpenSessionFromHistory && (
                      <button
                        className="nav-btn"
                        onClick={() => {
                          onOpenSessionFromHistory(item.sessionId || "");
                          setSessionHistoryOpen(false);
                        }}
                        style={{ marginTop: "8px", padding: "8px 12px", fontSize: "12px", fontWeight: "800", textTransform: "uppercase", border: "1px solid #00336644", color: "#003366", background: "#ffffff" }}
                      >
                        Open Session
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-btns" style={{ marginTop: "16px" }}>
              <button className="modal-cancel" onClick={() => setSessionHistoryOpen(false)}>Close</button>
              <button className="modal-confirm" style={{ background: "#003366" }} onClick={handleOpenSessionHistory}>
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
