// utils/csrf.ts
export async function getCsrfToken() {
  const res = await fetch("http://localhost:5000/api/csrf-token", {
    credentials: "include", // send cookies for session
  });
  const data = await res.json();
  return data.csrfToken;
}
