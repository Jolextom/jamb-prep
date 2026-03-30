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
  enterReview: () => void;
  hasSavedSession: boolean;
  isLoading: boolean;
  fetchError: string | null;
  availableSubjects: string[];
  availableCounts: Record<string, number>;
  isDataReady: boolean;
  candidateName: string;
  setCandidateName: (v: string) => void;
}

export default function SetupScreen({
  configs,
  setConfigs,
  sessionMode,
  setSessionMode,
  startExam,
  resumeExam,
  enterReview,
  hasSavedSession,
  isLoading,
  fetchError,
  availableSubjects,
  availableCounts,
  isDataReady,
  candidateName,
  setCandidateName
}: SetupScreenProps) {
  
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
    setConfigs((prev) => ({
      ...prev,
      [name]: { ...prev[name], count },
    }));
  };

  // Only show subjects that have local JSON data
  const filteredSubjects = SUBJECT_METADATA.filter(m => availableSubjects.includes(m.name));

  const anySelected = Object.values(configs).some(c => c.selected);

  return (
    <div className="setup-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px", minHeight: "100vh" }}>
      <div className="setup-container" style={{ maxWidth: "900px", width: "100%", margin: "0 auto", background: "white", borderRadius: "8px", border: "1px solid #ccc", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        
        <div className="jamb-header" style={{ padding: "12px 16px" }}>
          <div className="jamb-logo">
            <div className="jamb-logo-circle" style={{ width: "30px", height: "30px", fontSize: "8px" }}>JAMB</div>
            <div className="jamb-logo-text" style={{ fontSize: "10px" }}>
              <strong>UTME 2026</strong>
            </div>
          </div>
        </div>

        <div className="setup-content" style={{ padding: "16px" }}>
          <h2 style={{ fontSize: "16px", color: "#003366", marginBottom: "15px", fontWeight: "800" }}>Configure Your Session</h2>
          
          {/* Candidate ID Section */}
          <div style={{ marginBottom: "16px", background: "#f0f7ff", padding: "12px", borderRadius: "8px", border: "1px solid #c8d8f0" }}>
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
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid #003366",
                fontSize: "14px",
                outline: "none",
                fontWeight: "600",
                color: "#003366"
              }}
            />
          </div>
          
          <div className="setup-grid" style={{ display: "grid", gap: "30px" }}>
            
            <div className="subjects-section">
              <h3 style={{ fontSize: "14px", textTransform: "uppercase", color: "#666", marginBottom: "15px", letterSpacing: "1px" }}>
                Active Subjects ({availableSubjects.length} available)
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "400px", overflowY: "auto", paddingRight: "10px" }}>
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
                            max={availableCounts[s.name] || 60} 
                            value={conf.count} 
                            onChange={(e) => {
                              const val = Math.min(parseInt(e.target.value) || 0, availableCounts[s.name] || 60);
                              updateCount(s.name, val);
                            }}
                            style={{ width: "60px", padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mode-section" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "#f9f9f9", padding: "12px", borderRadius: "8px", border: "1px dashed #ccc" }}>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", color: "#666", marginBottom: "10px" }}>Session Mode</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button 
                    className={`nav-btn ${sessionMode === 'EXAM' ? 'primary' : ''}`}
                    onClick={() => setSessionMode('EXAM')}
                    style={{ flex: 1, fontSize: "12px", padding: "10px" }}
                  >
                    EXAM MODE
                  </button>
                  <button 
                    className={`nav-btn ${sessionMode === 'PRACTICE' ? 'primary' : ''}`}
                    onClick={() => setSessionMode('PRACTICE')}
                    style={{ flex: 1, fontSize: "12px", padding: "10px" }}
                  >
                    PRACTICE MODE
                  </button>
                </div>
              </div>

              {fetchError && (
                <div style={{ color: "#cc0000", background: "#fee", padding: "12px", borderRadius: "6px", fontSize: "13px", border: "1px solid #fcc" }}>
                  ⚠️ {fetchError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button 
                  className="nav-btn primary" 
                  onClick={startExam} 
                  disabled={isLoading || !candidateName.trim() || !anySelected} 
                  style={{ padding: "15px", fontSize: "16px", fontWeight: "800" }}
                >
                  {isLoading ? "Loading Questions..." : "GENERATE NEW EXAM"}
                </button>
                <div style={{ display: "flex", gap: "10px" }}>
                    {hasSavedSession && (
                        <button className="nav-btn" onClick={resumeExam} style={{ flex: 1, background: "#008000", color: "white" }}>
                            RESUME PREVIOUS
                        </button>
                    )}
                    {/* <button className="nav-btn" onClick={enterReview} style={{ flex: 1, background: "#cc8800", color: "white" }}>
                        MASTER PERFORMANCE
                    </button> */}
                </div>
              </div>
              
              <div style={{ fontSize: "12px", color: "#555", background: "#f9f9f9", padding: "10px", borderRadius: "6px", border: "1px dashed #ccc" }}>
                {sessionMode === 'EXAM'
                  ? "Timed. Answers and solutions shown after you submit."
                  : "Untimed. See if your answer is correct immediately after each question."}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
