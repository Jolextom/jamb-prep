"use client";

import React from "react";

interface LandingPageProps {
  onStart: (mode: "Exam" | "Practice") => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-10 rounded-xl shadow-lg border border-gray-200 w-full max-w-2xl text-center">
        <h1 className="text-4xl font-bold text-blue-800 mb-4 tracking-tight">
          CBT Examination Portal
        </h1>
        <p className="text-gray-600 mb-10 text-lg">
          Welcome to the standardized testing platform. Please select your preferred mode to begin.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => onStart("Exam")}
            className="flex flex-col items-center bg-blue-600 hover:bg-blue-700 text-white p-8 rounded-xl transition-all shadow-md group border-2 border-transparent hover:border-blue-400"
          >
            <span className="text-2xl font-bold mb-2">Exam Mode</span>
            <span className="text-sm opacity-90">Strict 2-hour countdown timer. No pauses.</span>
          </button>

          <button
            onClick={() => onStart("Practice")}
            className="flex flex-col items-center bg-white hover:bg-gray-50 text-blue-800 border-2 border-blue-200 p-8 rounded-xl transition-all shadow-sm group hover:border-blue-600"
          >
            <span className="text-2xl font-bold mb-2 text-blue-800">Practice Mode</span>
            <span className="text-sm text-gray-500">No timer. Take your time to learn.</span>
          </button>
        </div>

        <div className="mt-12 text-sm text-gray-400">
          <p>© 2026 Standardized Testing Software. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
