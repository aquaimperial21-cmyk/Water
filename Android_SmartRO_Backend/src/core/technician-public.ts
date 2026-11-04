// What a customer may see about their technician: who is coming and how to
// reach them. Never the employee record (salary, bank, ID-number hashes,
// home address, emergency contact) or the technician's login row.
export const technicianForCustomer = {
  select: { id: true, user: { select: { fullName: true, phone: true } } },
} as const;
