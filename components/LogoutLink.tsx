"use client";

export default function LogoutLink() {
  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.href = "/login";
  }
  return (
    <button onClick={logout} className="hover:text-white">
      Sign out
    </button>
  );
}
