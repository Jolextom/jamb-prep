"use client";

import React from "react";
import { Question } from "./types";

interface ModalsProps {
  sessionMode: 'EXAM' | 'PRACTICE';
  qbState: Record<string, Question[]>;
  activeSubjects: string[];
  answers: Record<string, string>;
  
  endModalOpen: boolean;
  resultModalOpen: boolean;
  closeEndModal: () => void;
  submitExam: () => void;
  
  totalAnswered: number;
  totalQuestions: number;
  finalScore: number;
  jambScore: number;
  breakdown: string[];
  copyDiagnosticData: () => void;

  // Resume Session Props
  resumePromptOpen: boolean;
  onResumeSession: () => void;
  onClearSession: () => void;

  // Review Props
  onReview: () => void;
  importAIReview: (json: string) => void;
  aiModalOpen: boolean;
  closeAiModal: () => void;
}

export default function Modals({
  sessionMode,
  qbState,
  activeSubjects,
  answers,
  endModalOpen,
  resultModalOpen,
  closeEndModal,
  submitExam,
  totalAnswered,
  totalQuestions,
  finalScore,
  jambScore,
  breakdown,
  copyDiagnosticData,
  resumePromptOpen,
  onResumeSession,
  onClearSession,
  onReview,
  importAIReview,
  aiModalOpen,
  closeAiModal
}: ModalsProps) {
  const [pasteValue, setPasteValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const key = (sIdx: number, qIdx: number) => `${sIdx}-${qIdx}`;

  const handleImport = () => {
    try {
      JSON.parse(pasteValue); // Check if valid JSON
      importAIReview(pasteValue);
      setPasteValue("");
      setError(null);
    } catch (err: any) {
      setError("Invalid JSON format. Please ensure you copied the full object.");
    }
  };

  return (
    <>
      {/* Resume Session Prompt */}
      <div className={`modal-bg ${resumePromptOpen ? 'open' : ''}`}>
        <div className="modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>⏸️</div>
          <h3 style={{ color: '#003366', fontWeight: '800', marginBottom: '10px' }}>Session in Progress</h3>
          <p style={{ fontSize: '14px', color: '#555', marginBottom: '24px' }}>
            You have an unfinished exam session. Would you like to continue where you left off, or start a new session?
          </p>
          <div className="modal-btns">
            <button className="modal-cancel" onClick={onClearSession} style={{ background: '#f3f4f6', color: '#333' }}>Start Fresh</button>
            <button className="modal-confirm" onClick={onResumeSession} style={{ background: '#003366' }}>▶ Continue</button>
          </div>
        </div>
      </div>
      {/* End Exam Confirmation */}
      <div className={`modal-bg ${endModalOpen ? "open" : ""}`}>
        <div className="modal-box">
          <h3>Confirm Submission</h3>
          <p>
            You have answered <strong>{totalAnswered}</strong> out of <strong>{totalQuestions}</strong> questions.
            Are you sure you want to end the {sessionMode === 'EXAM' ? "examination" : "practice session"}?
          </p>
          <div className="modal-btns">
            <button className="modal-cancel" onClick={closeEndModal}>Go Back</button>
            <button className="modal-confirm" onClick={submitExam}>Submit</button>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <div className={`modal-bg ${resultModalOpen ? "open" : ""}`}>
        <div className="modal-box" style={{ maxWidth: "450px", width: "95%" }}>
          <h3 style={{ color: "#003366", fontSize: "18px", fontWeight: "800", textTransform: "uppercase", marginBottom: "20px" }}>
            {sessionMode === 'EXAM' ? "Exam Result" : "Practice Summary"}
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", alignItems: "start" }}>
            {/* Stats */}
            <div style={{ width: "100%" }}>
              <div style={{ fontSize: "32px", fontWeight: "900", color: "#003366", margin: "12px 0", letterSpacing: "-1px" }}>
                {finalScore}/{totalQuestions} <span style={{ fontSize: "14px", opacity: 0.6 }}>CORRECT</span>
              </div>
              <div style={{ fontSize: "14px", color: "#008000", fontWeight: "700", marginBottom: "15px" }}>
                JAMB ESTIMATE: ~{jambScore}/400
              </div>
              
              <div style={{ fontSize: "13px", lineHeight: "1.8", textAlign: "left", background: "#f8fafc", padding: "15px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                {breakdown.map((line) => {
                  const [subj, scr] = line.split(": ");
                  return (
                    <div key={subj} style={{ display: "flex", justifyContent: "space-between" }}>
                      <strong style={{ opacity: 0.7 }}>{subj}:</strong> 
                      <span style={{ fontWeight: "800" }}>{scr}</span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
                {/* {sessionMode === 'PRACTICE' && activeSubjects.length === 1 && (
                    <button 
                      className="nav-btn" 
                      onClick={copyDiagnosticData} 
                      style={{ background: "#cc8800", color: "white", border: "none", width: "100%", padding: "12px" }}
                    >
                      📋 Copy Data for AI Tutor
                    </button>
                )} */}

                <button className="nav-btn primary" onClick={onReview} style={{ width: "100%", padding: "12px", background: "#003366" }}>
                  📋 See Answers & Explanations
                </button>

                <button className="nav-btn" onClick={() => window.location.reload()} style={{ width: "100%", padding: "12px" }}>
                  Start New Session
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Review Import Modal */}
      {/* <div className={`modal-bg ${aiModalOpen ? "open" : ""}`}>
        <div className="modal-box" style={{ maxWidth: "600px" }}>
          <h3 style={{ textTransform: "uppercase", fontWeight: "900", color: "#003366" }}>Mastery Performance Hub</h3>
          <p>Paste the optimized JSON response from the <strong>AI Architect</strong> below to re-master your latest session.</p>
          
          <textarea 
            placeholder='{"subject": "...", "route": [...] }'
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            style={{ width: "100%", height: "200px", padding: "12px", borderRadius: "6px", border: "1px solid #ddd", fontFamily: "monospace", fontSize: "12px", marginBottom: "15px" }}
          />

          {error && <p style={{ color: "#ef4444", fontWeight: "bold", fontSize: "12px", marginTop: "-10px", marginBottom: "15px" }}>{error}</p>}
          
          <div className="modal-btns">
            <button className="modal-cancel" onClick={closeAiModal}>Cancel</button>
            <button className="modal-confirm" onClick={handleImport} style={{ background: "#cc8800" }}>Import Review Path</button>
          </div>
        </div>
      </div> */}
    </>
  );
}
