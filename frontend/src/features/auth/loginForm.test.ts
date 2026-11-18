import { validateLogin } from './loginForm';

describe('validateLogin', () => {
  it('accepts an email and password', () => {
    expect(validateLogin({ email: 'hr.manager@acme.example', password: 'secret' })).toEqual({});
  });

  it('asks for both fields when empty', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Enter your email',
      password: 'Enter your password',
    });
  });

  it('treats a blank email as empty', () => {
    expect(validateLogin({ email: '   ', password: 'x' }).email).toBe('Enter your email');
  });

  it.each(['hr', 'hr@', '@acme.example', 'hr manager@acme.example'])(
    'rejects the email %s',
    (email) => {
      expect(validateLogin({ email, password: 'x' }).email).toBe('Enter a valid email address');
    },
  );
});
