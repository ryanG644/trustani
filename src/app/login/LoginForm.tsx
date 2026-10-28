"use client";

import { useActionState } from "react";
import { sendCode, verifyPhone, type LoginState } from "./actions";

export default function LoginForm({ next, phoneEnabled }: { next: string; phoneEnabled: boolean }) {
  const [sent, send, sending] = useActionState<LoginState, FormData>(sendCode, { next });
  const [verified, verify, verifying] = useActionState<LoginState, FormData>(verifyPhone, {});
  const phoneStep = sent.sent === "phone" || verified.sent === "phone";

  if (sent.sent === "email") {
    return <p className="notice good">Check your email for a sign-in link. It works once and expires in an hour.</p>;
  }

  if (phoneStep) {
    const phone = verified.phone ?? sent.phone;
    return (
      <form action={verify} className="stack">
        <input type="hidden" name="phone" value={phone} />
        <input type="hidden" name="next" value={next} />
        <div className="field">
          <label htmlFor="token">Code sent to {phone}</label>
          <input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" required maxLength={8} />
        </div>
        {verified.error && <p className="err" role="alert">{verified.error}</p>}
        <div><button className="btn primary" disabled={verifying}>{verifying ? "Checking…" : "Sign in"}</button></div>
      </form>
    );
  }

  return (
    <form action={send} className="stack">
      <input type="hidden" name="next" value={next} />
      {phoneEnabled && (
        <>
          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <input id="phone" name="phone" type="tel" placeholder="+263 77 123 4567" autoComplete="tel" />
            <span className="hint">We&apos;ll send a code by SMS. Or use email below.</span>
          </div>
          <div className="label">or</div>
        </>
      )}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required={!phoneEnabled} />
      </div>
      {sent.error && <p className="err" role="alert">{sent.error}</p>}
      <div><button className="btn primary" disabled={sending}>{sending ? "Sending…" : "Send sign-in link"}</button></div>
    </form>
  );
}
