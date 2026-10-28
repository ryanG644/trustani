import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/", error } = await searchParams;
  return (
    <>
      <h1 className="page-title">Sign in</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: "56ch" }}>
        You need an account to add sellers and post reviews, so one person can&apos;t pose as many. Browsing is open to everyone.
      </p>
      {error && <p className="err">That sign-in link has expired. Request a new one.</p>}
      <LoginForm next={next} phoneEnabled={process.env.NEXT_PUBLIC_PHONE_AUTH === "1"} />
    </>
  );
}
