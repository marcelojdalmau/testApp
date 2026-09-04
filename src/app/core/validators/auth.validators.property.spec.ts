import { FormControl, FormGroup } from '@angular/forms';
import * as fc from 'fast-check';
import { AuthValidators } from './auth.validators';

/**
 * Property-based tests for AuthValidators.
 * Feature: authentication
 *
 * These tests verify universal correctness properties hold across
 * all valid inputs using fast-check's property-based testing approach.
 */

describe('Feature: authentication, Property 1: Email validation rejects all invalid formats', () => {
  /**
   * **Validates: Requirements 1.8, 2.8, 3.4**
   *
   * For any string that does not match simplified RFC 5322 format
   * (missing @, missing domain, exceeding 254 characters, having invalid characters),
   * the email validator SHALL return a validation error.
   */
  const validator = AuthValidators.email();

  it('should reject strings without @ symbol', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.includes('@')),
        (input) => {
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).not.toBeNull();
          expect(result!['email']).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject strings with @ but no domain part after it', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => !s.includes('@')),
        (localPart) => {
          const input = `${localPart}@`;
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).not.toBeNull();
          expect(result!['email']).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject strings with @ but no TLD (no dot in domain)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/).filter(s => s.length > 0),
          fc.stringMatching(/^[a-zA-Z0-9-]+$/).filter(s => s.length > 0 && !s.startsWith('-') && !s.endsWith('-'))
        ),
        ([localPart, domain]) => {
          const input = `${localPart}@${domain}`;
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).not.toBeNull();
          expect(result!['email']).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject strings exceeding 254 characters', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 255, max: 500 }),
        (length) => {
          // Build an email-like string that exceeds 254 chars
          const localPart = 'a'.repeat(length - 12); // leave room for @example.com
          const input = `${localPart}@example.com`;
          if (input.length > 254) {
            const control = new FormControl(input);
            const result = validator(control);
            expect(result).not.toBeNull();
            expect(result!['email']).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept valid emails (positive counterpart)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          // Generate valid local parts: alphanumeric with some dots
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9.]{0,20}[a-zA-Z0-9]$/).filter(s => s.length >= 1 && !s.includes('..')),
          // Generate valid domain labels
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,10}$/).filter(s => s.length >= 1),
          // Generate valid TLD
          fc.stringMatching(/^[a-zA-Z]{2,6}$/)
        ),
        ([localPart, domain, tld]) => {
          const input = `${localPart}@${domain}.${tld}`;
          if (input.length <= 254) {
            const control = new FormControl(input);
            const result = validator(control);
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: authentication, Property 2: Password validation boundary enforcement', () => {
  /**
   * **Validates: Requirements 1.9, 2.9, 4.5, 5.5**
   *
   * For any string with length less than 8 or greater than 72 characters,
   * the password validator SHALL return a validation error; and for any string
   * with length between 8 and 72 (inclusive), the password validator SHALL return null (valid).
   */
  const validator = AuthValidators.password();

  it('should reject passwords shorter than 8 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 7 }),
        (input) => {
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).not.toBeNull();
          expect(result!['password']).toBeDefined();
          expect(result!['password'].minLength).toBe(8);
          expect(result!['password'].actualLength).toBe(input.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject passwords longer than 72 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 73, maxLength: 200 }),
        (input) => {
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).not.toBeNull();
          expect(result!['password']).toBeDefined();
          expect(result!['password'].maxLength).toBe(72);
          expect(result!['password'].actualLength).toBe(input.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept passwords between 8 and 72 characters (inclusive)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 72 }),
        (input) => {
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept passwords at exact boundary lengths (8 and 72)', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(8),
          fc.constant(72)
        ),
        (length) => {
          const input = 'x'.repeat(length);
          const control = new FormControl(input);
          const result = validator(control);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Feature: authentication, Property 3: Password confirmation match', () => {
  /**
   * **Validates: Requirements 2.10, 4.6, 5.6**
   *
   * For any two strings, the matchField validator SHALL return null when the strings
   * are equal and a validation error when they differ.
   */

  it('should return null when both fields have equal values', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (value) => {
          const group = new FormGroup({
            password: new FormControl(value),
            confirmPassword: new FormControl(value),
          });
          const matchValidator = AuthValidators.matchField('password');
          const confirmControl = group.get('confirmPassword')!;
          const result = matchValidator(confirmControl);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return a validation error when fields have different values', () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string(), fc.string()).filter(([a, b]) => a !== b),
        ([password, confirm]) => {
          const group = new FormGroup({
            password: new FormControl(password),
            confirmPassword: new FormControl(confirm),
          });
          const matchValidator = AuthValidators.matchField('password');
          const confirmControl = group.get('confirmPassword')!;
          const result = matchValidator(confirmControl);
          expect(result).not.toBeNull();
          expect(result!['matchField']).toBeDefined();
          expect(result!['matchField'].matchingField).toBe('password');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should work with any field name for matching', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_]{0,20}$/).filter(s => s.length >= 1),
          fc.string()
        ),
        ([fieldName, value]) => {
          const controls: Record<string, FormControl> = {};
          controls[fieldName] = new FormControl(value);
          controls['confirmField'] = new FormControl(value);
          const group = new FormGroup(controls);

          const matchValidator = AuthValidators.matchField(fieldName);
          const confirmControl = group.get('confirmField')!;
          const result = matchValidator(confirmControl);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
