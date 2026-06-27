export type PaymentMethodId = "credit_card" | "bank_transfer";

export type PaymentMethodOption = {
  id: PaymentMethodId;
  label: string;
  description: string;
};

export const paymentMethodOptions: PaymentMethodOption[] = [
  {
    id: "credit_card",
    label: "クレジットカード",
    description: "Visa / Mastercard / American Express など",
  },
  {
    id: "bank_transfer",
    label: "銀行振込",
    description: "ご入金確認後、発送または受け渡しのご案内をします",
  },
];

export function paymentMethodLabel(id: PaymentMethodId) {
  return paymentMethodOptions.find((option) => option.id === id)?.label ?? id;
}

export function isPaymentMethodId(value: string): value is PaymentMethodId {
  return value === "credit_card" || value === "bank_transfer";
}
