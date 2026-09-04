import { FormControl, FormGroup } from '@angular/forms';
import { AuthValidators } from './auth.validators';

describe('AuthValidators', () => {
  describe('email()', () => {
    const validator = AuthValidators.email();

    it('should return null for a valid email', () => {
      const control = new FormControl('user@example.com');
      expect(validator(control)).toBeNull();
    });

    it('should return null for empty value (defers to required validator)', () => {
      const control = new FormControl('');
      expect(validator(control)).toBeNull();
    });

    it('should return null for null value', () => {
      const control = new FormControl(null);
      expect(validator(control)).toBeNull();
    });

    it('should return error for email without @', () => {
      const control = new FormControl('userexample.com');
      expect(validator(control)).toEqual(jasmine.objectContaining({ email: jasmine.any(Object) }));
    });

    it('should return error for email without domain', () => {
      const control = new FormControl('user@');
      expect(validator(control)).toEqual(jasmine.objectContaining({ email: jasmine.any(Object) }));
    });

    it('should return error for email without TLD', () => {
      const control = new FormControl('user@example');
      expect(validator(control)).toEqual(jasmine.objectContaining({ email: jasmine.any(Object) }));
    });

    it('should return error for email exceeding 254 characters', () => {
      const longLocal = 'a'.repeat(243);
      const control = new FormControl(`${longLocal}@example.com`); // 255 chars
      expect(validator(control)).toEqual(jasmine.objectContaining({ email: jasmine.any(Object) }));
    });

    it('should accept email with subdomains', () => {
      const control = new FormControl('user@mail.example.com');
      expect(validator(control)).toBeNull();
    });

    it('should accept email with special characters in local part', () => {
      const control = new FormControl('user.name+tag@example.com');
      expect(validator(control)).toBeNull();
    });
  });

  describe('password()', () => {
    const validator = AuthValidators.password();

    it('should return null for password with 8 characters', () => {
      const control = new FormControl('12345678');
      expect(validator(control)).toBeNull();
    });

    it('should return null for password with 72 characters', () => {
      const control = new FormControl('a'.repeat(72));
      expect(validator(control)).toBeNull();
    });

    it('should return null for empty value (defers to required validator)', () => {
      const control = new FormControl('');
      expect(validator(control)).toBeNull();
    });

    it('should return error for password with 7 characters', () => {
      const control = new FormControl('1234567');
      expect(validator(control)).toEqual(jasmine.objectContaining({ password: jasmine.any(Object) }));
    });

    it('should return error for password with 73 characters', () => {
      const control = new FormControl('a'.repeat(73));
      expect(validator(control)).toEqual(jasmine.objectContaining({ password: jasmine.any(Object) }));
    });

    it('should return null for password within bounds', () => {
      const control = new FormControl('validPass123');
      expect(validator(control)).toBeNull();
    });
  });

  describe('matchField()', () => {
    it('should return null when fields match', () => {
      const group = new FormGroup({
        password: new FormControl('myPassword1'),
        confirmPassword: new FormControl('myPassword1', [AuthValidators.matchField('password')]),
      });
      const confirmControl = group.get('confirmPassword')!;
      expect(confirmControl.errors).toBeNull();
    });

    it('should return error when fields do not match', () => {
      const group = new FormGroup({
        password: new FormControl('myPassword1'),
        confirmPassword: new FormControl('different', [AuthValidators.matchField('password')]),
      });
      const confirmControl = group.get('confirmPassword')!;
      confirmControl.updateValueAndValidity();
      expect(confirmControl.errors).toEqual(jasmine.objectContaining({ matchField: jasmine.any(Object) }));
    });

    it('should return null when there is no parent form group', () => {
      const control = new FormControl('value');
      const validator = AuthValidators.matchField('password');
      expect(validator(control)).toBeNull();
    });

    it('should return null when the matching field does not exist in the group', () => {
      const group = new FormGroup({
        confirmPassword: new FormControl('value', [AuthValidators.matchField('nonExistent')]),
      });
      const confirmControl = group.get('confirmPassword')!;
      expect(confirmControl.errors).toBeNull();
    });
  });

  describe('required()', () => {
    const validator = AuthValidators.required();

    it('should return null for non-empty value', () => {
      const control = new FormControl('hello');
      expect(validator(control)).toBeNull();
    });

    it('should return error for null value', () => {
      const control = new FormControl(null);
      expect(validator(control)).toEqual(jasmine.objectContaining({ required: jasmine.any(Object) }));
    });

    it('should return error for undefined value', () => {
      const control = new FormControl(undefined);
      expect(validator(control)).toEqual(jasmine.objectContaining({ required: jasmine.any(Object) }));
    });

    it('should return error for empty string', () => {
      const control = new FormControl('');
      expect(validator(control)).toEqual(jasmine.objectContaining({ required: jasmine.any(Object) }));
    });

    it('should return error for whitespace-only string', () => {
      const control = new FormControl('   ');
      expect(validator(control)).toEqual(jasmine.objectContaining({ required: jasmine.any(Object) }));
    });

    it('should return null for value with leading/trailing spaces but content', () => {
      const control = new FormControl('  hello  ');
      expect(validator(control)).toBeNull();
    });
  });
});
