"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function PasscodeForm() {
  const searchParams = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitPasscode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const response = await fetch("/api/passcode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.error ?? "Incorrect passcode.");
      setIsSubmitting(false);
      return;
    }

    window.location.href = searchParams.get("next") || "/";
  }

  return (
    <main className="passcode-shell">
      <form className="passcode-card" onSubmit={submitPasscode}>
        <p className="eyebrow">Private family app</p>
        <h1>Bennett Homeschool Records</h1>
        <label>
          Passcode
          <input
            autoComplete="current-password"
            autoFocus
            inputMode="text"
            type="password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
          />
        </label>
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={isSubmitting || !passcode}>
          {isSubmitting ? "Checking..." : "Submit"}
        </button>
      </form>
    </main>
  );
}

export default function PasscodePage() {
  return (
    <Suspense fallback={null}>
      <PasscodeForm />
    </Suspense>
  );
}
