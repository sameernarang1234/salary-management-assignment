export interface LoginValues {
  email: string;
  password: string;
}

export type LoginErrors = Partial<Record<keyof LoginValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Quick checks before sending; the server still validates everything. */
export function validateLogin({ email, password }: LoginValues): LoginErrors {
  const errors: LoginErrors = {};
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    errors.email = 'Enter your email';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address';
  }
  if (!password) {
    errors.password = 'Enter your password';
  }
  return errors;
}
