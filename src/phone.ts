const normalizeDigits = (value: string) =>
  value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

/** Normalize Persian and Arabic numerals and remove common phone formatting. */
export const normalizePhoneNumber = (value: string): string =>
  normalizeDigits(value).replace(/[\s()-]/g, '')
