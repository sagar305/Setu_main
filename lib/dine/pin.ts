// Counter PIN for the Free Dine lock screen (FR-10.2).
//
// The hashing itself is identical to the Browser Based POS's, so it is reused
// rather than reimplemented — this re-export is the single place the dependency
// lives, and it moves no data between the two products. Both apps salt and
// SHA-256 the PIN so a glance at the database never reveals it; neither is a
// defence against someone holding the unlocked device with dev tools open.

export {
  generateSalt,
  hashPin,
  verifyPin,
  isValidPinFormat,
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
} from "@/lib/pos/pin";
