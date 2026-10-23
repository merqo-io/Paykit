/** wa.me wants digits only, with the country code; a bare 8-digit SG number gets 65. */
export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 8 ? "65" + digits : digits;
  return `https://wa.me/${withCountry}`;
}
