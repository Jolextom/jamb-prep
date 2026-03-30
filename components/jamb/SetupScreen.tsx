"use client";

import React from "react";
import { SUBJECT_METADATA, SubjectConfigs } from "./types";

interface SetupScreenProps {
  configs: SubjectConfigs;
  setConfigs: React.Dispatch<React.SetStateAction<SubjectConfigs>>;
  sessionMode: 'MOCK' | 'MASTERY';
  setSessionMode: (v: 'MOCK' | 'MASTERY') => void;
  startExam: () => void;
  resumeExam: () => void;
  enterReview: () => void;
  hasSavedSession: boolean;
  isLoading: boolean;
  fetchError: string | null;
  availableSubjects: string[];
  availableCounts: Record<string, number>;
  isDataReady: boolean;
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
  isDataReady
}: SetupScreenProps) {
  
  const toggleSubject = (name: string) => {
    setConfigs((prev) => {
      const isSelected = prev[name].selected;
      
      // Mastery Mode Enforced: Only 1 can be selected
      if (sessionMode === 'MASTERY' && !isSelected) {
        const next = { ...prev };
        // Deselect all others
        Object.keys(next).forEach(k => next[k] = { ...next[k], selected: false });
        next[name] = { ...next[name], selected: true };
        return next;
      }
      
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

  return (
    <div className="setup-wrapper" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px", minHeight: "100vh" }}>
      <div className="setup-container" style={{ maxWidth: "900px", width: "100%", margin: "0 auto", background: "white", borderRadius: "8px", border: "1px solid #ccc", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        
        <div className="jamb-header" style={{ padding: "20px" }}>
          <div className="jamb-logo">
            <div className="jamb-logo-circle">JAMB</div>
            <div className="jamb-logo-text">
              <strong>UTME 2025</strong>
              Professional CBT Simulation Engine
            </div>
          </div>
        </div>

        <div className="setup-content" style={{ padding: "30px" }}>
          <h2 style={{ fontSize: "20px", color: "#003366", marginBottom: "20px", fontWeight: "800" }}>Configure Your Session</h2>
          
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
                        padding: "12px", 
                        border: "1px solid #ddd", 
                        borderRadius: "6px", 
                        display: "flex", 
                        flexDirection: "column",
                        gap: "10px",
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

            <div className="mode-section" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", border: "1px dashed #ccc" }}>
                <h3 style={{ fontSize: "14px", textTransform: "uppercase", color: "#666", marginBottom: "15px" }}>Session Mode</h3>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button 
                    className={`nav-btn ${sessionMode === 'MOCK' ? 'primary' : ''}`}
                    onClick={() => setSessionMode('MOCK')}
                    style={{ flex: 1, fontSize: "12px", padding: "10px" }}
                  >
                    MOCK (MULTI)
                  </button>
                  <button 
                    className={`nav-btn ${sessionMode === 'MASTERY' ? 'primary' : ''}`}
                    onClick={() => {
                        setSessionMode('MASTERY');
                        // Ensure only 1 or 0 subjects selected when switching to Mastery
                        const selected = Object.keys(configs).filter(k => configs[k].selected);
                        if (selected.length > 1) {
                            setConfigs(prev => {
                                const next = { ...prev };
                                selected.slice(1).forEach(k => next[k].selected = false);
                                return next;
                            });
                        }
                    }}
                    style={{ flex: 1, fontSize: "12px", padding: "10px" }}
                  >
                    MASTERY (SINGLE)
                  </button>
                </div>
              </div>

              {fetchError && (
                <div style={{ color: "#cc0000", background: "#fee", padding: "12px", borderRadius: "6px", fontSize: "13px", border: "1px solid #fcc" }}>
                  ⚠️ {fetchError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button className="nav-btn primary" onClick={startExam} disabled={isLoading} style={{ padding: "15px", fontSize: "16px", fontWeight: "800" }}>
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
              
              {!isDataReady && (
                <p style={{ fontSize: "12px", color: "#888", textAlign: "center" }}>Initializing data engine...</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
