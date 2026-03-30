"use client";

import React, { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QuestionChatProps {
  candidateName: string;
  questionContext: string; // Question + options + correct answer + solution
  questionId: number;      // Used to reset chat when question changes
  history: Message[];
  onUpdateMessages: (messages: Message[]) => void;
}

const MAX_MESSAGES = 20; // per question session

export default function QuestionChat({ candidateName, questionContext, questionId, history, onUpdateMessages }: QuestionChatProps) {
  const [messages, setMessages] = useState<Message[]>(history);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history when the question changes
  useEffect(() => {
    setMessages(history);
    setInput("");
    setError(null);
  }, [questionId, history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isAtLimit = userMessageCount >= MAX_MESSAGES;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || isAtLimit) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          questionContext,
          candidateName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setMessages(newMessages.slice(0, -1)); // remove the user message on error
      } else {
        const finalMessages = [...newMessages, { role: "assistant" as const, content: data.reply }];
        setMessages(finalMessages);
        onUpdateMessages(finalMessages);
      }
    } catch {
      setError("Network error. Please check your connection.");
      setMessages(newMessages.slice(0, -1));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getPlaceholder = () => {
    if (isAtLimit) return "Limit reached.";
    if (messages.length === 0) return "Have a question about this question?";
    return "Any other question?";
  };

  return (
    <div style={{ marginTop: "16px", width: "100%" }}>
      {/* Chat panel - Always visible now */}
      <div
          style={{
            border: "1px solid #c8d8f0",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,51,102,0.12)",
            background: "#fff",
            width: "100%",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 16px",
              background: "linear-gradient(135deg, #003366, #0055a5)",
              color: "white",
            }}
          >
            <span style={{ fontWeight: "800", fontSize: "13px", letterSpacing: "0.5px" }}>
              ASK THE TUTOR
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "11px", opacity: 0.75 }}>
                {userMessageCount}/{MAX_MESSAGES} messages
              </span>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              height: "260px",
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "#f8faff",
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "#888", fontSize: "13px", marginTop: "60px" }}>
                Ask me anything about this question!
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "82%",
                    padding: "10px 14px",
                    borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    background: m.role === "user" ? "#003366" : "#fff",
                    color: m.role === "user" ? "white" : "#1a1a2e",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    border: m.role === "assistant" ? "1px solid #e2e8f0" : "none",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: "18px 18px 18px 4px",
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    color: "#888",
                    fontSize: "13px",
                  }}
                >
                  <span className="typing-dots">Thinking</span>
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              padding: "10px 12px",
              borderTop: "1px solid #e8eef8",
              background: "#fff",
              alignItems: "center",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()}
              disabled={isLoading || isAtLimit}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 14px",
                border: "1px solid #c8d8f0",
                borderRadius: "24px",
                fontSize: "14px",
                outline: "none",
                background: isAtLimit ? "#f5f5f5" : "#fff",
                color: "#333",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || isAtLimit || !input.trim()}
              style={{
                width: "48px",
                height: "36px",
                borderRadius: "18px",
                background: isLoading || isAtLimit || !input.trim() ? "#ccc" : "#003366",
                color: "white",
                border: "none",
                cursor: isLoading || isAtLimit || !input.trim() ? "not-allowed" : "pointer",
                fontSize: "11px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontWeight: "bold"
              }}
            >
              {isLoading ? "..." : "SEND"}
            </button>
        </div>

        <style>{`
          .typing-dots::after {
            content: '...';
            animation: dots 1.2s steps(3, end) infinite;
          }
          @keyframes dots {
            0%   { content: '.'; }
            33%  { content: '..'; }
            66%  { content: '...'; }
            100% { content: '.'; }
          }
        `}</style>
        </div>
      </div>
    );
}
