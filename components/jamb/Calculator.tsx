"use client";

import React from "react";

interface CalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  calcExpr: string;
  setCalcExpr: React.Dispatch<React.SetStateAction<string>>;
  calcRef: React.RefObject<HTMLDivElement | null>;
  position: { top: number; left: number };
}

export default function Calculator({
  isOpen,
  onClose,
  calcExpr,
  setCalcExpr,
  calcRef,
  position
}: CalculatorProps) {
  const calcInput = (v: string) => {
    if (v === "C") {
      setCalcExpr("0");
    } else if (v === "CE") {
      setCalcExpr((prev) => prev.slice(0, -1) || "0");
    } else if (v === "=") {
      try {
        const e = calcExpr.replace(/÷/g, "/").replace(/×/g, "*");
        // eslint-disable-next-line no-eval
        const res = eval(e);
        setCalcExpr(String(Math.round(res * 1e10) / 1e10));
      } catch {
        setCalcExpr("Error");
      }
    } else if (v === "%") {
      try {
        // eslint-disable-next-line no-eval
        setCalcExpr(String(eval(calcExpr) / 100));
      } catch {
        setCalcExpr("Error");
      }
    } else {
      setCalcExpr((prev) => {
        if (prev === "0" && !"+-*/".includes(v) && v !== ".") return v;
        return prev + v;
      });
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      // If the click is on the calculator-button itself, we let the toggleCalc handle it
      // but usually the click outside is for closing.
      // We check if click is outside calcRef
      if (calcRef.current && !calcRef.current.contains(e.target as Node)) {
        // Check if it's not the calculator button
        const target = e.target as HTMLElement;
        if (!target.closest('.calc-btn')) {
          onClose();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, calcRef]);

  return (
    <div
      ref={calcRef}
      className={`calc-popup ${isOpen ? "open" : ""}`}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 9999
      }}
    >
      <div className="calc-display">{calcExpr}</div>
      <div className="calc-grid">
        {["C", "CE", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="].map((btn) => {
          let cls = "c-btn";
          if (["C", "CE"].includes(btn)) cls += " clr";
          if (["%", "÷", "×", "−", "+"].includes(btn)) cls += " op";
          if (btn === "=") cls += " eq";
          return (
            <button
              key={btn}
              className={cls}
              onClick={() => {
                let val = btn;
                if (btn === "÷") val = "/";
                if (btn === "×") val = "*";
                if (btn === "−") val = "-";
                calcInput(val);
              }}
            >
              {btn}
            </button>
          );
        })}
      </div>
    </div>
  );
}
