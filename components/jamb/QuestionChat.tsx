"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChallengeOption {
  letter: "A" | "B" | "C" | "D";
  text: string;
}

interface ParsedChallenge {
  options: ChallengeOption[];
  cleanedContent: string;
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
    } catch (e) { }

    setInput("");
  }, [questionId, history]);

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const isAtLimit = userMessageCount >= MAX_MESSAGES;

  const sendSpecificMessage = async (overrideText?: string) => {
    const text = overrideText || input.trim();
    if (!text || isLoading || isAtLimit) return;

    // Clear draft for this question upon sending
    try {
      const draftsState = localStorage.getItem("jamb_chat_drafts");
      if (draftsState) {
        const drafts = JSON.parse(draftsState);
        delete drafts[questionId];
        localStorage.setItem("jamb_chat_drafts", JSON.stringify(drafts));
      }
    } catch (e) { }

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
    } catch (e) { }

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
        }).catch(() => { });
      }

      if (!res.ok) {
        let errText = "Something went wrong. Please try again.";
        try {
          const data = await res.json();
          if (data.error) errText = data.error;
        } catch (e) { }
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
    }
  };

  const sendMessage = () => sendSpecificMessage();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const optionLineRegex = /^\s*([A-D])[\)\.]\s+(.+?)\s*$/;

  const isChallengeMessage = (content: string) =>
    (content.includes("[!TIP]") || content.includes("[!NOTE]")) && /\bA[\)\.]\s+/m.test(content);

  const parseChallengeMessage = (content: string): ParsedChallenge => {
    const lines = content.split(/\r?\n/);
    const candidates: { lineIndex: number; letter: "A" | "B" | "C" | "D"; text: string }[] = [];

    lines.forEach((line, idx) => {
      const match = line.match(optionLineRegex);
      if (!match) return;
      const letter = match[1] as "A" | "B" | "C" | "D";
      candidates.push({ lineIndex: idx, letter, text: match[2].trim() });
    });

    let chosenStart = -1;
    for (let i = 0; i <= candidates.length - 4; i++) {
      const seq = candidates.slice(i, i + 4);
      const isOrderedABCD =
        seq[0].letter === "A" &&
        seq[1].letter === "B" &&
        seq[2].letter === "C" &&
        seq[3].letter === "D";
      const isContiguousLines =
        seq[1].lineIndex === seq[0].lineIndex + 1 &&
        seq[2].lineIndex === seq[1].lineIndex + 1 &&
        seq[3].lineIndex === seq[2].lineIndex + 1;

      if (isOrderedABCD && isContiguousLines) {
        chosenStart = i;
      }
    }

    if (chosenStart === -1) {
      return { options: [], cleanedContent: content };
    }

    const chosen = candidates.slice(chosenStart, chosenStart + 4);
    const removeLineIndices = new Set(chosen.map((item) => item.lineIndex));

    return {
      options: chosen.map((item) => ({ letter: item.letter, text: item.text })),
      cleanedContent: lines
        .filter((_, idx) => !removeLineIndices.has(idx))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    };
  };

  const isOptionSelectionMessage = (content: string) =>
    /\b(i\s*choose\s*option|option\s*[A-D]\b|my\s*answer\s*is\s*[A-D]\b|i\s*pick\s*[A-D]\b)\b/i.test(content);

  const latestChallengeIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "assistant" && isChallengeMessage(msg.content)) {
        return i;
      }
    }
    return -1;
  })();

  const latestChallengeOptions =
    latestChallengeIndex >= 0
      ? parseChallengeMessage(messages[latestChallengeIndex].content).options
      : [];

  const isLatestChallengeResolved = (() => {
    if (latestChallengeIndex < 0) return true;
    let userSelectedOption = false;

    for (let i = latestChallengeIndex + 1; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user" && isOptionSelectionMessage(msg.content)) {
        userSelectedOption = true;
      }
      if (msg.role === "assistant" && userSelectedOption) {
        return true;
      }
    }
    return false;
  })();

  const shouldShowStickyChallengeOptions =
    latestChallengeIndex >= 0 &&
    !isLatestChallengeResolved &&
    latestChallengeIndex !== messages.length - 1 &&
    latestChallengeOptions.length > 0;

  const getPlaceholder = () => {
    if (isAtLimit) return "Limit reached.";
    if (messages.length === 0) return "Have a question about this question?";
    return "Any other question?";
  };

  return (
    <div style={{ marginTop: "16px", width: "100%" }}>
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
            padding: "12px 16px",
            background: "linear-gradient(135deg, #003366, #0055a5)",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span style={{ fontWeight: "800", fontSize: "12px", letterSpacing: "1px" }}>
            JAMB AI ASSISTANT
          </span>
          <span style={{ fontSize: "11px", opacity: 0.8 }}>
            {userMessageCount}/{MAX_MESSAGES} messages
          </span>
        </div>

        {/* Scrollable Area */}
        <div
          style={{
            height: "300px",
            overflowY: "auto",
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "#f0f4f8"
          }}
        >
          {/* Quick Chips if no messages */}
          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ color: "#003366", fontWeight: "600", fontSize: "14px", marginBottom: "4px" }}>Master this concept</p>
              <p style={{ color: "#64748b", fontSize: "12px", marginBottom: "16px" }}>Ask for help, then request a similar question if you want one.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                {[
                  "Can you give me a similar question?",
                  "Give me a speed hack for this",
                  "Explain why the others are wrong"
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => sendSpecificMessage(q)}
                    style={{
                      background: "white",
                      border: "1px solid #c8d8f0",
                      padding: "8px 16px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      color: "#003366",
                      fontWeight: "600",
                      width: "fit-content",
                      cursor: "pointer",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isAssistant = m.role === "assistant";
            const parsedChallenge = isAssistant && isChallengeMessage(m.content)
              ? parseChallengeMessage(m.content)
              : { options: [], cleanedContent: m.content };
            const optionsMatches = parsedChallenge.options;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.role === "user" ? "flex-end" : "flex-start",
                  gap: "8px",
                  width: "100%"
                }}
              >
                <div style={{
                  position: "relative",
                  maxWidth: "92%",
                  width: isAssistant ? "fit-content" : "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.role === "user" ? "flex-end" : "stretch"
                }}>
                  <div
                    className={isAssistant ? "ai-bubble" : "user-bubble"}
                    style={{
                      padding: "12px 18px",
                      borderRadius: m.role === "user" ? "24px 24px 4px 24px" : "24px 24px 24px 4px",
                      background: m.role === "user" ? "#003366" : "#fff",
                      color: m.role === "user" ? "white" : "#111",
                      fontSize: "14px",
                      lineHeight: "1.7",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                      border: isAssistant ? "1px solid #eef2ff" : "none",
                    }}
                  >
                    {isAssistant ? (
                      <div className="chat-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            img: ({ node, ...props }) => (
                              <img {...props} style={{ maxWidth: "100%", borderRadius: "8px", margin: "10px 0" }} />
                            )
                          }}
                        >
                          {/* Only strip options from challenge messages; leave regular responses intact */}
                          {isChallengeMessage(m.content)
                            ? parsedChallenge.cleanedContent
                              .replace(/\[!TIP\]/g, "💡")
                              .replace(/\[!NOTE\]/g, "📝")
                              .replace(/\[!IMPORTANT\]/g, "🚨")
                              .replace(/\[!WARNING\]/g, "⚠️")
                            : m.content
                              .replace(/\[!IMPORTANT\]/g, "🚨")
                              .replace(/\[!WARNING\]/g, "⚠️")
                          }
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
                    )}
                  </div>

                  {/* Keep options visible for the latest unresolved challenge, even after follow-up user text. */}
                  {isAssistant && i === latestChallengeIndex && optionsMatches.length > 0 && !isLoading && !isLatestChallengeResolved && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: optionsMatches.length > 2 ? "repeat(auto-fit, minmax(200px, 1fr))" : "1fr",
                      gap: "8px",
                      marginTop: "10px",
                      width: "100%"
                    }}>
                      {optionsMatches.map((match, idx) => {
                        const letter = match.letter;
                        const text = match.text;
                        return (
                          <button
                            key={idx}
                            onClick={() => sendSpecificMessage(`I choose option ${letter}`)}
                            style={{
                              padding: "10px 12px",
                              background: "#fff",
                              border: "1.5px solid #00336615",
                              borderRadius: "10px",
                              fontSize: "13px",
                              color: "#003366",
                              fontWeight: "600",
                              textAlign: "left",
                              cursor: "pointer",
                              display: "flex",
                              gap: "10px",
                              alignItems: "center",
                              transition: "all 0.2s"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = "#003366";
                              e.currentTarget.style.background = "#f0f7ff";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = "#00336615";
                              e.currentTarget.style.background = "#fff";
                            }}
                          >
                            <span style={{ background: "#003366", color: "white", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", flexShrink: 0 }}>{letter}</span>
                            <span>{text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div style={{ alignSelf: "flex-start", padding: "10px 16px", borderRadius: "18px", background: "#fff", color: "#64748b", fontSize: "13px", border: "1px solid #eef2ff" }}>
              <span className="typing-dots">AI is thinking</span>
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 16px", background: "#fee2e2", color: "#b91c1c", borderRadius: "12px", fontSize: "12px" }}>
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {shouldShowStickyChallengeOptions && (
          <div
            style={{
              padding: "10px 12px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            <span style={{ fontSize: "12px", color: "#003366", fontWeight: 700 }}>
              Still on the last challenge? Pick an option quickly:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {latestChallengeOptions.map((match, idx) => {
                const letter = match.letter;
                const text = match.text;
                return (
                  <button
                    key={`sticky-${idx}`}
                    onClick={() => sendSpecificMessage(`I choose option ${letter}`)}
                    disabled={isLoading}
                    style={{
                      padding: "8px 10px",
                      background: "white",
                      border: "1px solid #c8d8f0",
                      borderRadius: "999px",
                      fontSize: "12px",
                      color: "#003366",
                      fontWeight: "600",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.7 : 1
                    }}
                    title={text}
                  >
                    {letter}) {text.length > 42 ? `${text.slice(0, 42)}...` : text}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div style={{ padding: "12px", background: "#fff", borderTop: "1px solid #eef2ff", display: "flex", gap: "8px" }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              // Persist draft to localStorage
              try {
                const draftsState = localStorage.getItem("jamb_chat_drafts");
                const drafts = draftsState ? JSON.parse(draftsState) : {};
                drafts[questionId] = val;
                localStorage.setItem("jamb_chat_drafts", JSON.stringify(drafts));
              } catch (e) { }
            }}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isLoading || isAtLimit}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "24px",
              border: "1px solid #c8d8f0",
              fontSize: "14px",
              outline: "none"
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || isAtLimit || !input.trim()}
            style={{
              padding: "0 16px",
              borderRadius: "24px",
              background: (isLoading || isAtLimit || !input.trim()) ? "#cbd5e1" : "#003366",
              color: "white",
              border: "none",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            SEND
          </button>
        </div>

        <style>{`
            .typing-dots::after { content: '...'; animation: dots 1.5s steps(3, end) infinite; }
            @keyframes dots { 0% { content: '.'; } 33% { content: '..'; } 66% { content: '...'; } 100% { content: '.'; } }
            .chat-markdown blockquote {
              margin: 4px 0 12px 0;
              padding: 8px 12px;
              background: #f1f5f9;
              border-left: 4px solid #003366;
              border-radius: 4px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .chat-markdown blockquote p { margin: 0 !important; font-weight: 700; color: #003366; }
            .chat-markdown p { margin: 0 0 8px 0; }
            .chat-markdown p:last-child { margin: 0; }
          `}</style>
      </div>
    </div>
  );
}
