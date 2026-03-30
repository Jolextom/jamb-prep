"use client";

import React, { useState } from "react";
import { Question, Option, mockQuestions } from "@/lib/mockData";
import Timer from "./Timer";

interface CBTInterfaceProps {
  mode: "Exam" | "Practice";
  onSubmit: (answers: Record<number, Option>) => void;
}

export default function CBTInterface({ mode, onSubmit }: CBTInterfaceProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Option>>({});

  const currentQuestion = mockQuestions[currentIdx];

  const handleOptionSelect = (option: Option) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  const goToNext = () => {
    if (currentIdx < mockQuestions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const goToPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleJumpTo = (idx: number) => {
    setCurrentIdx(idx);
  };

  const isAnswered = (id: number) => !!answers[id];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Bar */}
      <header className="bg-blue-800 text-white p-4 shadow-md sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h2 className="text-xl font-bold tracking-tight">CBT Portal</h2>
          <div className="hidden md:flex items-center space-x-2 bg-blue-900/50 px-3 py-1 rounded-full border border-blue-700/50">
            <span className="text-sm font-medium opacity-80 uppercase tracking-widest">Mode:</span>
            <span className="text-sm font-bold">{mode}</span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          {mode === "Exam" && (
            <Timer initialSeconds={7200} onTimeUp={() => onSubmit(answers)} />
          )}
          <button
            onClick={() => onSubmit(answers)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg active:scale-95"
          >
            Submit Exam
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left/Center: Question Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
              <span className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-sm font-bold">
                Question {currentIdx + 1} of {mockQuestions.length}
              </span>
            </div>

            <div className="flex-1">
              <h3 className="text-2xl font-medium text-gray-800 leading-relaxed mb-10">
                {currentQuestion.question}
              </h3>

              <div className="space-y-4">
                {(Object.entries(currentQuestion.options) as [Option, string][]).map(
                  ([key, val]) => (
                    <label
                      key={key}
                      className={`flex items-center p-5 rounded-xl border-2 cursor-pointer transition-all ${
                        answers[currentQuestion.id] === key
                          ? "border-blue-600 bg-blue-50 shadow-inner"
                          : "border-gray-100 hover:border-blue-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={key}
                        checked={answers[currentQuestion.id] === key}
                        onChange={() => handleOptionSelect(key)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <span className="ml-5 text-lg font-medium text-gray-700">
                        <span className="font-bold mr-3">{key}.</span> {val}
                      </span>
                    </label>
                  )
                )}
              </div>
            </div>

            <div className="mt-12 flex justify-between pt-6 border-t border-gray-100">
              <button
                onClick={goToPrev}
                disabled={currentIdx === 0}
                className="px-8 py-3 bg-white border-2 border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <button
                onClick={goToNext}
                disabled={currentIdx === mockQuestions.length - 1}
                className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 transition-all flex items-center shadow-md active:scale-95"
              >
                Next
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Side Panel: Grid */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 sticky top-24">
            <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Question Grid
            </h4>
            <div className="grid grid-cols-5 gap-3">
              {mockQuestions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => handleJumpTo(i)}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all border-2 ${
                    currentIdx === i
                      ? "border-blue-800 bg-blue-800 text-white shadow-md scale-110 z-10"
                      : isAnswered(q.id)
                      ? "bg-green-100 border-green-500 text-green-700 hover:bg-green-200"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <div className="mt-8 space-y-3 pt-6 border-t border-gray-100">
              <div className="flex items-center text-xs text-gray-500 font-medium">
                <span className="w-4 h-4 bg-green-100 border border-green-500 rounded mr-2"></span>
                Answered
              </div>
              <div className="flex items-center text-xs text-gray-500 font-medium">
                <span className="w-4 h-4 bg-gray-50 border border-gray-200 rounded mr-2"></span>
                Unanswered
              </div>
              <div className="flex items-center text-xs text-gray-500 font-medium">
                <span className="w-4 h-4 bg-blue-800 rounded mr-2"></span>
                Current View
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
