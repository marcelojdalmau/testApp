import { AbstractControl, ValidatorFn, ValidationErrors } from '@angular/forms';

/**
 * Custom validators for authentication forms.
 * Provides email, password, field matching, and required validators
 * aligned with the backend's validation rules.
 */
export class AuthValidators {
  /**
   * Validates email format using a simplified RFC 5322 pattern.
   * - Must contain exactly one @
   * - Local part allows alphanumerics and special chars: .!#$%&'*+/=?^_`{|}~-
   * - Domain part must have at least one dot-separated label
   * - Total length must not exceed 254 characters
   */
  static email(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null; // Let required validator handle empty values
      }

      const strValue = String(value);

      if (strValue.length > 254) {
        return { email: { message: 'Email must not exceed 254 characters' } };
      }

      // Simplified RFC 5322 email pattern:
      // local-part@domain
      // local-part: one or more allowed characters (alphanumeric, .!#$%&'*+/=?^_`{|}~-)
      // domain: one or more labels separated by dots, each label is alphanumeric/hyphens
      const emailPattern =
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

      if (!emailPattern.test(strValue)) {
        return { email: { message: 'Please enter a valid email address' } };
      }

      return null;
    };
  }

  /**
   * Validates password length is between 8 and 72 characters (inclusive).
   * Matches the Cognito/backend password length constraints.
   */
  static password(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;
      if (!value) {
        return null; // Let required validator handle empty values
      }

      const strValue = String(value);

      if (strValue.length < 8) {
        return { password: { message: 'Password must be at least 8 characters', minLength: 8, actualLength: strValue.length } };
      }

      if (strValue.length > 72) {
        return { password: { message: 'Password must not exceed 72 characters', maxLength: 72, actualLength: strValue.length } };
      }

      return null;
    };
  }

  /**
   * Validates that the control's value matches the value of another field in the same form group.
   * Used for password confirmation fields.
   *
   * @param fieldName - The name of the field to match against (e.g., 'password' or 'new_password')
   */
  static matchField(fieldName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const parent = control.parent;
      if (!parent) {
        return null;
      }

      const fieldToMatch = parent.get(fieldName);
      if (!fieldToMatch) {
        return null;
      }

      if (control.value !== fieldToMatch.value) {
        return { matchField: { message: 'Passwords do not match', matchingField: fieldName } };
      }

      return null;
    };
  }

  /**
   * Validates that the control's value is non-empty after trimming whitespace.
   * A stricter alternative to Angular's built-in Validators.required that
   * rejects whitespace-only values.
   */
  static required(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (value === null || value === undefined) {
        return { required: { message: 'This field is required' } };
      }

      const strValue = String(value).trim();

      if (strValue.length === 0) {
        return { required: { message: 'This field is required' } };
      }

      return null;
    };
  }
}
