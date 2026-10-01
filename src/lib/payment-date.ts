const TIME_ZONE = "America/Sao_Paulo";

function assertDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Data de pagamento inválida.");
  }

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Data de pagamento inválida.");
  }
}

export function saoPauloDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error("Data de pagamento inválida.");

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function addBusinessDays(dateKey: string, days: number) {
  assertDateKey(dateKey);
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  let remaining = days;

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekDay = date.getUTCDay();
    if (weekDay !== 0 && weekDay !== 6) remaining -= 1;
  }

  return date.toISOString().slice(0, 10);
}

export function minimumPaymentDate(validationDate = new Date()) {
  return addBusinessDays(saoPauloDateKey(validationDate), 2);
}

export function utcDateKey(date: Date) {
  if (Number.isNaN(date.getTime())) throw new Error("Data de pagamento inválida.");

  return date.toISOString().slice(0, 10);
}

export function paymentDateAtSaoPauloNoon(dateKey: string) {
  assertDateKey(dateKey);
  return new Date(`${dateKey}T12:00:00-03:00`);
}

export function isPaymentDateKeyAllowed(paymentDateKey: string, validationDate = new Date()) {
  assertDateKey(paymentDateKey);
  return paymentDateKey >= minimumPaymentDate(validationDate);
}
