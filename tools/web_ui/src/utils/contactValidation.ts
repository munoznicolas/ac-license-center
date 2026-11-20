export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

export function validateContactInput(input: ContactInput): string | null {
  const name = (input.name || "").trim();
  const email = (input.email || "").trim();
  const message = (input.message || "").trim();

  if (name.length < 1 || name.length > 80) {
    return "Please enter your name (1–80 characters).";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address or leave it blank.";
  }
  if (message.length < 10) {
    return "Please enter a message of at least 10 characters.";
  }
  return null;
}
