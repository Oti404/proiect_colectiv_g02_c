import { ApiError } from '../api/api.types';

/** Mesajele pentru utilizator la erorile de login / înregistrare, alese după `code`. */
export function authErrorMessage(err: unknown): string {
  const error = ApiError.from(err);
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'Wrong email or password.';
    case 'EMAIL_TAKEN':
      return 'An account with this email already exists. Try signing in instead.';
    case 'VALIDATION_ERROR':
      return 'Some fields are not valid. Check the highlighted fields.';
    case 'NETWORK_ERROR':
      return 'The server cannot be reached. Is the backend running?';
    default:
      return 'Something went wrong. Please try again.';
  }
}
