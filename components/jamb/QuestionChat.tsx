"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  // Load history and draft when the question changes
  useEffect(() => {
    setMessages(history);
    setError(null);
    
    try {
      const draftsState = localStorage.getItem("jamb_chat_drafts");
      if (draftsState) {
        const drafts = JSON.parse(draftsState);
        setInput(drafts[questionId] || "");
        return;
      }
    } catch(e) {}
    
    setInput("");
  }, [questionId, history]);

  // Remove the auto-scroll that was pulling the page down unexpectedly
  // useEffect(() => {
  //   bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [messages]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isAtLimit = userMessageCount >= MAX_MESSAGES;

  const sendSpecificMessage = async (overrideText?: string) => {
    const text = overrideText || input.trim();
    if (!text || isLoading || isAtLimit) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    // Clear draft on send
    try {
      const stored = localStorage.getItem("jamb_chat_drafts");
      if (stored) {
        const drafts = JSON.parse(stored);
        delete drafts[questionId];
        localStorage.setItem("jamb_chat_drafts", JSON.stringify(drafts));
      }
    } catch(e) {}

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

      // Track the activity for Admin Dashboard
      if (res.ok) {
        fetch("/api/admin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            type: "chat", 
            name: candidateName, 
            detail: text.substring(0, 100) 
          }),
        }).catch(() => {});
      }

      if (!res.ok) {
        let errText = "Something went wrong. Please try again.";
        try {
          const data = await res.json();
          if (data.error) errText = data.error;
        } catch(e) {}
        setError(errText);
        setMessages(newMessages.slice(0, -1)); // remove the user message on error
        setIsLoading(false);
        return;
      }

      setIsLoading(false); // Stop loading animation since we are receiving stream
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";
      let currentMessages = [...newMessages, { role: "assistant" as const, content: "" }];
      setMessages(currentMessages);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || "";
        
        for (const chunk of chunks) {
          const trimmedChunk = chunk.trim();
          if (trimmedChunk.startsWith('data: ') && trimmedChunk !== 'data: [DONE]') {
            try {
              const data = JSON.parse(trimmedChunk.slice(6));
              const text = data.choices[0]?.delta?.content;
              if (text) {
                assistantContent += text;
                currentMessages = [...newMessages, { role: "assistant" as const, content: assistantContent }];
                setMessages(currentMessages);
              }
            } catch (e) {
              // Ignore incomplete JSON
            }
          }
        }
      }
      onUpdateMessages(currentMessages);

    } catch (e) {
      console.error(e);
      setError("Network error. Please check your connection.");
      setMessages(newMessages.slice(0, -1));
      setIsLoading(false);
    } finally {
      // Do not auto-focus here, as it pulls mobile screens down away from the response.
    }
  };

  const sendMessage = () => sendSpecificMessage();

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
              ASK AI
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
              <div style={{ textAlign: "center", marginTop: "20px", padding: "0 10px" }}>
                <div style={{ color: "#003366", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  Need a breakdown?
                </div>
                <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "20px" }}>
                  Ask the Pro Coach for speed hacks, concept reviews, or trick explanations.
                </div>
                
                {/* Quick Action Chips */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                  {[
                    "Explain why the others are wrong",
                    "Give me a speed hack for this",
                    "Break down the concept step-by-step"
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        setInput(chip);
                        // We need to wait for state to update before sending, so we pass the text directly to a slightly modified sendMessage
                        sendSpecificMessage(chip);
                      }}
                      style={{
                        background: "#e0f2fe",
                        color: "#0369a1",
                        border: "1px solid #bae6fd",
                        borderRadius: "16px",
                        padding: "8px 16px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        width: "100%",
                        maxWidth: "280px"
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
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
                    fontSize: "14.5px",
                    lineHeight: "1.6",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    border: m.role === "assistant" ? "1px solid #e2e8f0" : "none",
                  }}
                  className="chat-markdown"
                >
                  {m.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  ) : (
                    <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                  )}
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
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                try {
                  const stored = localStorage.getItem("jamb_chat_drafts");
                  const drafts = stored ? JSON.parse(stored) : {};
                  if (val.trim()) drafts[questionId] = val;
                  else delete drafts[questionId];
                  localStorage.setItem("jamb_chat_drafts", JSON.stringify(drafts));
                } catch(err) {}
              }}
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
          .chat-markdown p { margin-bottom: 8px; }
          .chat-markdown p:last-child { margin-bottom: 0; }
          .chat-markdown strong { font-weight: 700; color: #003366; }
          .chat-markdown ul { margin-left: 20px; margin-bottom: 8px; }
          .chat-markdown ol { margin-left: 20px; margin-bottom: 8px; }
          .chat-markdown li { margin-bottom: 4px; }
        `}</style>
        </div>
      </div>
    );
}
