import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const EGYPT_LOCAL_REGEX = /^01(0|1|2|5)\d{8}$/;

export function normalizeEgyptianPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('0020')) {
    return `0${digits.slice(4)}`;
  }

  if (digits.startsWith('20')) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

export function isValidEgyptianPhone(raw: string | null | undefined): boolean {
  return EGYPT_LOCAL_REGEX.test(normalizeEgyptianPhone(raw));
}

export function egyptianPhoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = (control.value ?? '').toString();
    if (!value.trim()) {
      return { required: true };
    }

    return isValidEgyptianPhone(value) ? null : { egyptianPhone: true };
  };
}