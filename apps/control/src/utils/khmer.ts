const errorTranslations: Array<[RegExp, string]> = [
  [/invalid email or password/i, "អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវទេ។"],
  [/authentication required/i, "សូមចូលគណនីដើម្បីបន្ត។"],
  [
    /session has expired/i,
    "សម័យប្រើប្រាស់របស់អ្នកបានផុតកំណត់។ សូមចូលគណនីម្តងទៀត។",
  ],
  [
    /subscription has expired/i,
    "ការជាវរបស់អ្នកបានផុតកំណត់។ ផ្ទាំងគ្រប់គ្រងនេះអាចមើលបានតែប៉ុណ្ណោះ។",
  ],
  [/current password is incorrect/i, "ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវទេ។"],
  [/account not found/i, "រកមិនឃើញគណនីនេះទេ។"],
  [/password reset/i, "គណនីនេះត្រូវកំណត់ពាក្យសម្ងាត់ឡើងវិញ។"],
  [/not found/i, "រកមិនឃើញទិន្នន័យដែលបានស្នើទេ។"],
  [/request failed/i, "សំណើមិនបានសម្រេចទេ។ សូមសាកល្បងម្តងទៀត។"],
  [/could not be completed/i, "មិនអាចបញ្ចប់សំណើបានទេ។ សូមសាកល្បងម្តងទៀត។"],
  [/choose an active menu before saving this qr design/i, "ជ្រើសរើសម៉ឺនុយដែលកំពុងប្រើ មុនពេលរក្សាទុកការរចនា QR នេះ។"],
  [
    /remove menu items and child categories before deleting this category/i,
    "សូមផ្លាស់ទី ឬលុបមុខម្ហូប និងប្រភេទរងជាមុនសិន។",
  ],
  [
    /products with orders cannot be deleted/i,
    "មិនអាចលុបមុខម្ហូបដែលមានប្រវត្តិការកម្មង់បានទេ។",
  ],
  [
    /upload a jpg, png or webp image up to 8 mb/i,
    "សូមបង្ហោះរូបភាព JPG, PNG ឬ WebP ទំហំមិនលើស 8 MB។",
  ],
];

export function khmerError(
  message: unknown,
  fallback = "មានបញ្ហាមួយបានកើតឡើង។ សូមសាកល្បងម្តងទៀត។",
) {
  const text = String(message || "").trim();
  if (!text) return fallback;
  const translation = errorTranslations.find(([pattern]) => pattern.test(text));
  return translation?.[1] || fallback;
}
