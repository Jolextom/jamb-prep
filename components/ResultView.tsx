"use client";

import React, { useState } from "react";
import { Question, Option } from "@/lib/mockData";

interface ResultViewProps {
  score: number;
  total: number;
  wrongOrSkipped: {
    question: string;
    chosen_option: Option | "None";
    correct_option: Option;
  }[];
}

export default function ResultView({ score, total, wrongOrSkipped }: ResultViewProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const payload = JSON.stringify(wrongOrSkipped, null, 2);
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const percentage = (score / total) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6">
      <div className="bg-white p-10 rounded-xl shadow-lg border border-gray-200 w-full max-w-2xl text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <svg
              className="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Exam Completed!</h1>
        </div>

        <div className="mb-8 p-6 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-gray-600 mb-2">Your Final Score:</p>
          <div className="text-5xl font-extrabold text-blue-800">
            {score} <span className="text-2xl text-blue-400">/ {total}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-blue-600">
            Performance: {percentage.toFixed(1)}%
          </p>
        </div>

        <p className="text-gray-500 mb-8 italic">
          "Success is the sum of small efforts, repeated day in and day out."
        </p>

        <div className="space-y-4 relative">
          {copied && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-xl animate-bounce">
              Copied to Clipboard!
            </div>
          )}
          <button
            onClick={copyToClipboard}
            className={`w-full py-4 px-6 rounded-xl font-bold transition-all transform active:scale-95 flex items-center justify-center space-x-2 shadow-md ${
              copied
                ? "bg-green-600 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <span>{copied ? "Copied!" : "Copy Diagnostic Data"}</span>
            {copied ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                ></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                ></path>
              </svg>
            )}
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}
